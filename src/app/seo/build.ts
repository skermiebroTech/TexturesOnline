// Build-time site generation: one static HTML file per public page (real content, head tags and
// structured data), the 404.html fallback that boots the app for private project URLs, plus
// sitemap.xml, robots.txt, llms.txt and llms-full.txt. Pure string work: the Vite plugin in
// vite.config.ts supplies the built index.html, the icon SVGs and the chunk file names.

import type { IconName } from '../../ui/icons';
import { logoSvgMarkup } from '../../ui/logo';
import { el, escapeAttr, escapeHtml, flatten, ic, renderHtml, renderMarkdown, renderText, type Child, type HtmlContext } from '../markup';
import { skipLink, topbar } from '../content/chrome';
import { BING_SITE_VERIFICATION, GOOGLE_SITE_VERIFICATION, REPO_URL, SITE_NAME, SITE_SUMMARY, SITE_URL, absoluteUrl } from '../site';
import { ABOUT_META, ALL_META, GUIDES, GUIDES_META, HELP_META, TOOL_META, allPublicPages, localizedPath, translatedPages, type PageMeta } from './meta';
import { LOCALE_INFO, TRANSLATED_LOCALES, splitLocale, type Locale } from '../../i18n/locales';
import { PRERENDERED_ATTR, PRERENDERED_YEAR_ATTR, prerenderedKey } from '../hydrate-attrs';
import { TOOL_INTROS } from '../content/tools';
import { DIFFERENCES } from '../../tools/about/content';
import { prerenderPages, type PrerenderPage } from './pages';
import { KNOWN_RELEASE_FORMATS, formatPackFormat } from '../../editions/java/packformats';

export interface SiteBuildInput {
  /** The index.html Vite produced (asset URLs start with "./") */
  template: string;
  /** Inner markup of a pixelarticons SVG */
  iconSvg(name: IconName): string;
  /** Built files (relative to the site root) for source modules: CSS to link, JS to preload */
  assetsFor(modules: string[]): { css: string[]; js: string[] };
  /** Built file (relative to the site root) of an imported asset such as an image; without it pages preload no images */
  assetFile?(source: string): string;
  /** YYYY-MM-DD */
  buildDate: string;
}

export interface SiteFile {
  fileName: string;
  source: string;
}

export const ROBOTS_PUBLIC = 'index,follow,max-image-preview:large';
export const ROBOTS_PRIVATE = 'noindex,follow';

/** Hosts the editors download game files from (preconnected on tool pages). */
export const PRECONNECT_HOSTS = ['https://piston-meta.mojang.com', 'https://piston-data.mojang.com', 'https://raw.githubusercontent.com'];

/** Crawlers named explicitly in robots.txt (all crawlers are allowed by the `User-agent: *` rule anyway). */
export const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'Amazonbot',
  'meta-externalagent',
  'DuckAssistBot',
  'cohere-ai',
  'MistralAI-User',
];

/** Output file for a route path: '/' -> 'index.html', '/help' -> 'help/index.html' */
export function pageFileName(path: string): string {
  return path === '/' ? 'index.html' : `${path.replace(/^\/+|\/+$/g, '')}/index.html`;
}

/** Prefix that leads from a page back to the site root ('./', '../', '../../'). */
export function rootPrefix(path: string): string {
  const depth = path === '/' ? 0 : path.replace(/^\/+|\/+$/g, '').split('/').length;
  return depth ? '../'.repeat(depth) : './';
}

/** href for an internal route path or site file, relative to a page ('/help?s=faq' -> '../help/?s=faq'). */
export function relativeHref(to: string, prefix: string): string {
  const m = /^([^?#]*)(\?[^#]*)?(#.*)?$/.exec(to) ?? ['', to, '', ''];
  const path = m[1] || '/';
  const rest = (m[2] ?? '') + (m[3] ?? '');
  const clean = path.replace(/^\/+/, '');
  if (!clean) return (prefix || './') + rest;
  const isFile = /\.[a-z0-9]+$/i.test(clean);
  return `${prefix}${clean}${isFile || clean.endsWith('/') ? '' : '/'}${rest}`;
}

/** Every icon used by the prerendered pages (the plugin loads their SVGs). */
export function iconNamesUsed(): Set<IconName> {
  const names = new Set<IconName>();
  const walk = (c: Child) => {
    for (const n of flatten([c])) {
      if (typeof n === 'string') continue;
      if (n.kind === 'icon') names.add(n.name);
      else if (n.kind === 'el') walk(n.children);
    }
  };
  for (const p of prerenderPages()) walk(p.body(2000));
  walk(topbar(null));
  walk(skipLink());
  walk(ic('globe'));
  return names;
}

function escapeJson(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function metaTag(attr: 'name' | 'property', key: string, value: string): string {
  return `<meta ${attr}="${key}" content="${escapeAttr(value)}" />`;
}

/** hreflang links of a page: every language it exists in, plus x-default (English). */
export function alternateLinks(page: PrerenderPage): { hreflang: string; href: string }[] {
  const en = page.alternates.find((a) => a.locale === 'en');
  return [...page.alternates.map((a) => ({ hreflang: LOCALE_INFO[a.locale].lang, href: a.url })), ...(en ? [{ hreflang: 'x-default', href: en.url }] : [])];
}

/** Head tags for a public page. */
export function headTags(page: PrerenderPage): string {
  const m = page.meta;
  const url = absoluteUrl(m.path);
  const img = page.og.image;
  const tags = [
    `<title>${escapeHtml(m.title)}</title>`,
    metaTag('name', 'description', m.description),
    `<link rel="canonical" href="${url}" />`,
    ...alternateLinks(page).map((a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />`),
    metaTag('name', 'robots', ROBOTS_PUBLIC),
    GOOGLE_SITE_VERIFICATION ? metaTag('name', 'google-site-verification', GOOGLE_SITE_VERIFICATION) : '',
    BING_SITE_VERIFICATION ? metaTag('name', 'msvalidate.01', BING_SITE_VERIFICATION) : '',
    metaTag('property', 'og:type', page.og.type),
    metaTag('property', 'og:site_name', SITE_NAME),
    metaTag('property', 'og:locale', LOCALE_INFO[page.locale].ogLocale),
    ...page.alternates.filter((a) => a.locale !== page.locale).map((a) => metaTag('property', 'og:locale:alternate', LOCALE_INFO[a.locale].ogLocale)),
    metaTag('property', 'og:url', url),
    metaTag('property', 'og:title', m.title),
    metaTag('property', 'og:description', m.description),
    metaTag('property', 'og:image', absoluteUrl(img.path)),
    metaTag('property', 'og:image:width', String(img.width)),
    metaTag('property', 'og:image:height', String(img.height)),
    metaTag('property', 'og:image:alt', img.caption),
    metaTag('name', 'twitter:card', 'summary_large_image'),
    metaTag('name', 'twitter:title', m.title),
    metaTag('name', 'twitter:description', m.description),
    metaTag('name', 'twitter:image', absoluteUrl(img.path)),
    metaTag('name', 'twitter:image:alt', img.caption),
    ...(page.preconnect
      ? PRECONNECT_HOSTS.map((h) => `<link rel="preconnect" href="${h}" crossorigin />`)
      : PRECONNECT_HOSTS.map((h) => `<link rel="dns-prefetch" href="${h}" />`)),
    `<script type="application/ld+json">${escapeJson(page.jsonld())}</script>`,
  ];
  return tags.filter(Boolean).join('\n    ');
}

/** Rendering context of a page: links lead to pages in its language wherever they exist. */
function htmlContext(input: SiteBuildInput, prefix: string, locale: Locale = 'en'): HtmlContext {
  const logo = logoSvgMarkup();
  return { iconSvg: (n) => input.iconSvg(n), logoSvg: () => logo, link: (to, exact) => relativeHref(exact ? to : localizedPath(to, locale), prefix) };
}

/** Rewrites the template's "./" asset URLs for a page at another depth. */
function withPrefix(html: string, prefix: string): string {
  return prefix === './' ? html : html.replace(/(\s(?:href|src)=")\.\//g, `$1${prefix}`);
}

function setRootAttrs(html: string, tool: string, route: string, locale: Locale = 'en'): string {
  return html
    .replace(/<html([^>]*)>/, (_m, a: string) => `<html${a.replace(/\slang="[^"]*"/, ` lang="${LOCALE_INFO[locale].lang}"`)} data-tool="${tool}">`)
    .replace(/<body([^>]*)>/, (_m, a: string) => `<body${a} data-route="${route}">`);
}

function shellHtml(ctx: HtmlContext, nav: PrerenderPage['nav'] | null, main: string, boot: 'keep' | 'replace', locale: Locale = 'en'): string {
  return renderHtml([skipLink(locale), topbar(nav, locale)], ctx) + `<main id="main" class="page" tabindex="-1"${boot === 'replace' ? ' data-boot="replace"' : ''}>${main}</main>`;
}

function pageAssets(input: SiteBuildInput, page: PrerenderPage, prefix: string): string {
  const already = new Set(Array.from(input.template.matchAll(/\s(?:href|src)="\.\/([^"]+)"/g), (m) => m[1]));
  const styles = input.assetsFor(page.styles);
  const boot = input.assetsFor(page.preload);
  const css = styles.css.filter((f) => !already.has(f));
  const lateCss = boot.css.filter((f) => !already.has(f) && !css.includes(f));
  const js = [...new Set([...styles.js, ...boot.js])].filter((f) => !already.has(f));
  const images = input.assetFile ? (page.preloadImages ?? []).map((src) => input.assetFile!(src)) : [];
  return [
    ...css.map((f) => `<link rel="stylesheet" crossorigin href="${prefix}${f}">`),
    ...lateCss.map((f) => `<link rel="preload" as="style" crossorigin href="${prefix}${f}">`),
    ...js.map((f) => `<link rel="modulepreload" crossorigin href="${prefix}${f}">`),
    ...images.map((f) => `<link rel="preload" as="image" href="${prefix}${f}">`),
  ].join('\n    ');
}

/**
 * Marks the view of a page the app takes over as it is ('keep'): the language and route path it was
 * built for, and the footer's year. The router only reuses the markup when both still match.
 */
export function hydrationAttrs(page: PrerenderPage, year: number): Record<string, string> {
  if (page.boot !== 'keep') return {};
  const { locale, path } = splitLocale(page.meta.path);
  return { [PRERENDERED_ATTR]: prerenderedKey(locale, path), [PRERENDERED_YEAR_ATTR]: String(year) };
}

export function renderPage(input: SiteBuildInput, page: PrerenderPage, year: number): string {
  const prefix = rootPrefix(page.meta.path);
  const ctx = htmlContext(input, prefix, page.locale);
  const view = renderHtml(el('div', { class: page.viewClass, ...hydrationAttrs(page, year) }, page.body(year)), ctx);
  let html = withPrefix(input.template, prefix);
  html = html.replace('<!--app-head-->', headTags(page));
  html = html.replace('</head>', `  ${pageAssets(input, page, prefix)}\n  </head>`);
  html = html.replace('<!--app-html-->', shellHtml(ctx, page.nav, view, page.boot, page.locale));
  return setRootAttrs(html, page.tool, page.tool, page.locale);
}

/**
 * 404.html: GitHub Pages serves it for every unknown path, which includes private project URLs
 * (/textures/<id>). It boots the app there. Asset URLs are resolved from the site base at runtime
 * (the domain root, or the first path segment on a *.github.io project site).
 */
export function render404(input: SiteBuildInput): string {
  const base = new URL(SITE_URL).pathname;
  const ctx: HtmlContext = { ...htmlContext(input, base), link: (to) => relativeHref(to, SITE_URL) };
  let html = input.template;
  const assetTags: string[] = [];
  html = html.replace(/[ \t]*<(link|script)\b[^>]*\s(?:href|src)="\.\/[^"]*"[^>]*>(?:<\/script>)?\n?/g, (tag) => {
    assetTags.push(tag.trim());
    return '';
  });
  const tagsJson = JSON.stringify(assetTags.join('')).replace(/</g, '\\u003c');
  // On *.github.io the first path segment is the repository (project site) unless it is one of
  // the app's own sections (user site). Everywhere else the configured base applies.
  const sections = [...new Set([...allPublicPages().map((p) => p.path.split('/')[1]).filter(Boolean), ...TRANSLATED_LOCALES, 'kit', 'assets'])];
  const loader = `<script>
      (function () {
        var b = ${JSON.stringify(base)};
        var m = /^\\/([^\\/]+)\\//.exec(location.pathname);
        if (m && /\\.github\\.io$/.test(location.hostname) && ${JSON.stringify(sections)}.indexOf(m[1]) < 0) b = '/' + m[1] + '/';
        // Served offline by the service worker, which knows the site root on any host.
        var hint = document.querySelector('meta[name="app-base"]');
        if (hint && /^\\/[^"<>]*\\/$|^\\/$/.test(hint.content)) b = hint.content;
        document.write(${tagsJson}.split('="./').join('="' + b));
      })();
    </script>`;
  const head = [
    `<title>${escapeHtml(SITE_NAME)}</title>`,
    metaTag('name', 'robots', 'noindex'),
    metaTag('name', 'description', SITE_SUMMARY),
    ...PRECONNECT_HOSTS.map((h) => `<link rel="preconnect" href="${h}" crossorigin />`),
    loader,
  ].join('\n    ');
  html = html.replace('<!--app-head-->', head);
  const body = el(
    'div',
    { class: 'view view-missing' },
    el(
      'div',
      { class: 'container fallback-body' },
      el(
        'div',
        { class: 'empty-state' },
        el('h1', { class: 'empty-title' }, 'Opening…'),
        el(
          'noscript',
          null,
          el('p', { class: 'muted' }, 'This page needs JavaScript. If the address is mistyped, start from the ', el('a', { to: '/' }, 'home page'), ' or the ', el('a', { to: '/guides' }, 'guides'), '.'),
        ),
      ),
    ),
  );
  html = html.replace('<!--app-html-->', shellHtml(ctx, null, renderHtml(body, ctx), 'replace'));
  return setRootAttrs(html, '', 'missing');
}

/** Every page with its language versions as xhtml:link alternates (the same set on each of them). */
export function sitemapXml(buildDate: string): string {
  const urls = prerenderPages().map((p) => {
    const alts = p.alternates.length > 1 ? alternateLinks(p).map((a) => `\n    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}"/>`).join('') : '';
    return `  <url>\n    <loc>${absoluteUrl(p.meta.path)}</loc>${alts}\n    <lastmod>${buildDate}</lastmod>\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
}

export function robotsTxt(): string {
  return [
    `# ${SITE_NAME} — ${SITE_URL}`,
    '# Everything is open to search engines and AI assistants. Private project pages carry a noindex tag.',
    '',
    'User-agent: *',
    'Allow: /',
    '',
    ...AI_CRAWLERS.map((ua) => `User-agent: ${ua}`),
    'Allow: /',
    '',
    `Sitemap: ${absoluteUrl('sitemap.xml')}`,
    '',
  ].join('\n');
}

const mdLink = (m: PageMeta, label = m.label) => `[${label}](${absoluteUrl(m.path)})`;

/** Tool names as people search for them (llms.txt link text). */
const TOOL_INTROS_NAMES: Record<string, string> = Object.fromEntries(Object.values(TOOL_INTROS).map((t) => [TOOL_META[t.tool].path, t.appName]));

export function llmsTxt(): string {
  const f = formatPackFormat(KNOWN_RELEASE_FORMATS['26.3']);
  const lines = [
    `# ${SITE_NAME}`,
    '',
    `> ${SITE_SUMMARY}`,
    '',
    `${SITE_NAME} (${SITE_URL}) makes Minecraft texture packs (resource packs), skins and shaders in the browser. It is free, needs no account and uploads nothing: the browser downloads the game's own textures from Mojang for the chosen version, and exports a ready-to-use .zip (Java, with the correct pack.mcmeta for that version) or .mcpack (Bedrock). Java 26.3 is the default (resource pack format ${f}); every Java release back to 1.6.1 is supported, plus Bedrock.`,
    '',
    '## Tools',
    '',
    ...Object.values(TOOL_META).map((m) => `- ${mdLink(m, TOOL_INTROS_NAMES[m.path] ?? m.label)}: ${m.description}`),
    '',
    '## What makes it different',
    '',
    ...DIFFERENCES.map((d) => `- **${d.title}**: ${renderText(d.text)}`),
    '',
    '## Guides',
    '',
    ...GUIDES.map((g) => `- ${mdLink(g, g.h1)}: ${g.description}`),
    '',
    '## Help',
    '',
    `- ${mdLink(HELP_META, 'Install guide & FAQ')}: ${HELP_META.description}`,
    `- ${mdLink(ABOUT_META, 'About')}: ${ABOUT_META.description}`,
    `- ${mdLink(ALL_META, 'Everything on the site')}: ${ALL_META.description}`,
    `- ${mdLink(GUIDES_META, 'All guides')}: ${GUIDES_META.description}`,
    '',
    '## Other languages',
    '',
    'Every page, guide and editor is also available in these languages:',
    '',
    ...TRANSLATED_LOCALES.map((l) => {
      const pages = translatedPages(l);
      const home = pages.find((m) => (m.route ?? m.path) === '/');
      return home ? `- ${LOCALE_INFO[l].englishName}: [${LOCALE_INFO[l].name}](${absoluteUrl(home.path)}), ${pages.length} pages including ${pages.filter((m) => m.kind === 'guide').length} guides` : '';
    }).filter(Boolean),
    '',
    '## Optional',
    '',
    `- [Full text of every public page](${absoluteUrl('llms-full.txt')}): the pages above as one Markdown file`,
    `- [Source code on GitHub](${REPO_URL}): MIT licence`,
    '',
  ];
  return lines.join('\n');
}

export function llmsFullTxt(buildDate: string): string {
  const ctx = { link: (to: string) => absoluteUrl(to) };
  // English only: the translations say the same thing.
  const parts = prerenderPages()
    .filter((p) => p.locale === 'en')
    .map((p) => {
    const body = renderMarkdown(p.content(), ctx);
    return `<!-- ${absoluteUrl(p.meta.path)} -->\n\n${body}\n\nSource: ${absoluteUrl(p.meta.path)}`;
  });
  return [`# ${SITE_NAME}: full text`, '', `> ${SITE_SUMMARY}`, '', `Generated ${buildDate} from ${SITE_URL}. Not an official Minecraft product; not approved by or associated with Mojang or Microsoft.`, '', ...parts.flatMap((p) => ['---', '', p, ''])].join('\n');
}

/** Everything the build writes besides the JS/CSS bundles. */
export function buildSite(input: SiteBuildInput): SiteFile[] {
  const year = Number(input.buildDate.slice(0, 4));
  const files: SiteFile[] = prerenderPages().map((p) => ({ fileName: pageFileName(p.meta.path), source: renderPage(input, p, year) }));
  files.push({ fileName: '404.html', source: render404(input) });
  files.push({ fileName: 'sitemap.xml', source: sitemapXml(input.buildDate) });
  files.push({ fileName: 'robots.txt', source: robotsTxt() });
  files.push({ fileName: 'llms.txt', source: llmsTxt() });
  files.push({ fileName: 'llms-full.txt', source: llmsFullTxt(input.buildDate) });
  return files;
}
