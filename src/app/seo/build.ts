// Build-time site generation: one static HTML file per public page (real content, head tags and
// structured data), the 404.html fallback that boots the app for private project URLs, plus
// sitemap.xml, robots.txt, llms.txt and llms-full.txt. Pure string work: the Vite plugin in
// vite.config.ts supplies the built index.html, the icon SVGs and the chunk file names.

import type { IconName } from '../../ui/icons';
import { logoSvgMarkup } from '../../ui/logo';
import { el, escapeAttr, escapeHtml, flatten, renderHtml, renderMarkdown, type Child, type HtmlContext } from '../markup';
import { skipLink, topbar } from '../content/chrome';
import { BING_SITE_VERIFICATION, GOOGLE_SITE_VERIFICATION, REPO_URL, SITE_NAME, SITE_SUMMARY, SITE_URL, absoluteUrl } from '../site';
import { GUIDES, GUIDES_META, HELP_META, PUBLIC_PAGES, TOOL_META, type PageMeta } from './meta';
import { prerenderPages, type PrerenderPage } from './pages';
import { KNOWN_RELEASE_FORMATS, formatPackFormat } from '../../editions/java/packformats';

export interface SiteBuildInput {
  /** The index.html Vite produced (asset URLs start with "./") */
  template: string;
  /** Inner markup of a pixelarticons SVG */
  iconSvg(name: IconName): string;
  /** Built files (relative to the site root) for source modules: CSS to link, JS to preload */
  assetsFor(modules: string[]): { css: string[]; js: string[] };
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
  return names;
}

function escapeJson(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function metaTag(attr: 'name' | 'property', key: string, value: string): string {
  return `<meta ${attr}="${key}" content="${escapeAttr(value)}" />`;
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
    metaTag('name', 'robots', ROBOTS_PUBLIC),
    GOOGLE_SITE_VERIFICATION ? metaTag('name', 'google-site-verification', GOOGLE_SITE_VERIFICATION) : '',
    BING_SITE_VERIFICATION ? metaTag('name', 'msvalidate.01', BING_SITE_VERIFICATION) : '',
    metaTag('property', 'og:type', page.og.type),
    metaTag('property', 'og:site_name', SITE_NAME),
    metaTag('property', 'og:locale', 'en_US'),
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

function htmlContext(input: SiteBuildInput, prefix: string): HtmlContext {
  const logo = logoSvgMarkup();
  return { iconSvg: (n) => input.iconSvg(n), logoSvg: () => logo, link: (to) => relativeHref(to, prefix) };
}

/** Rewrites the template's "./" asset URLs for a page at another depth. */
function withPrefix(html: string, prefix: string): string {
  return prefix === './' ? html : html.replace(/(\s(?:href|src)=")\.\//g, `$1${prefix}`);
}

function setRootAttrs(html: string, tool: string, route: string): string {
  return html.replace(/<html([^>]*)>/, (_m, a: string) => `<html${a} data-tool="${tool}">`).replace(/<body([^>]*)>/, (_m, a: string) => `<body${a} data-route="${route}">`);
}

function shellHtml(ctx: HtmlContext, nav: PrerenderPage['nav'] | null, main: string, boot: 'keep' | 'replace'): string {
  return renderHtml([skipLink(), topbar(nav)], ctx) + `<main id="main" class="page" tabindex="-1"${boot === 'replace' ? ' data-boot="replace"' : ''}>${main}</main>`;
}

function pageAssets(input: SiteBuildInput, page: PrerenderPage, prefix: string): string {
  const already = new Set(Array.from(input.template.matchAll(/\s(?:href|src)="\.\/([^"]+)"/g), (m) => m[1]));
  const styles = input.assetsFor(page.styles);
  const boot = input.assetsFor(page.preload);
  const css = styles.css.filter((f) => !already.has(f));
  const lateCss = boot.css.filter((f) => !already.has(f) && !css.includes(f));
  const js = [...new Set([...styles.js, ...boot.js])].filter((f) => !already.has(f));
  return [
    ...css.map((f) => `<link rel="stylesheet" crossorigin href="${prefix}${f}">`),
    ...lateCss.map((f) => `<link rel="preload" as="style" crossorigin href="${prefix}${f}">`),
    ...js.map((f) => `<link rel="modulepreload" crossorigin href="${prefix}${f}">`),
  ].join('\n    ');
}

export function renderPage(input: SiteBuildInput, page: PrerenderPage, year: number): string {
  const prefix = rootPrefix(page.meta.path);
  const ctx = htmlContext(input, prefix);
  const view = renderHtml(el('div', { class: page.viewClass }, page.body(year)), ctx);
  let html = withPrefix(input.template, prefix);
  html = html.replace('<!--app-head-->', headTags(page));
  html = html.replace('</head>', `  ${pageAssets(input, page, prefix)}\n  </head>`);
  html = html.replace('<!--app-html-->', shellHtml(ctx, page.nav, view, page.boot));
  return setRootAttrs(html, page.tool, page.tool);
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
  const sections = [...new Set([...PUBLIC_PAGES.map((p) => p.path.split('/')[1]).filter(Boolean), 'kit', 'assets'])];
  const loader = `<script>
      (function () {
        var b = ${JSON.stringify(base)};
        var m = /^\\/([^\\/]+)\\//.exec(location.pathname);
        if (m && /\\.github\\.io$/.test(location.hostname) && ${JSON.stringify(sections)}.indexOf(m[1]) < 0) b = '/' + m[1] + '/';
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

export function sitemapXml(buildDate: string): string {
  const urls = prerenderPages().map((p) => `  <url>\n    <loc>${absoluteUrl(p.meta.path)}</loc>\n    <lastmod>${buildDate}</lastmod>\n  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
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
    `- ${mdLink(TOOL_META.textures, 'Texture pack maker')}: ${TOOL_META.textures.description}`,
    `- ${mdLink(TOOL_META.skins, 'Skin editor')}: ${TOOL_META.skins.description}`,
    `- ${mdLink(TOOL_META.shaders, 'Shader maker')}: ${TOOL_META.shaders.description}`,
    '',
    '## Guides',
    '',
    ...GUIDES.map((g) => `- ${mdLink(g, g.h1)}: ${g.description}`),
    '',
    '## Help',
    '',
    `- ${mdLink(HELP_META, 'Install guide & FAQ')}: ${HELP_META.description}`,
    `- ${mdLink(GUIDES_META, 'All guides')}: ${GUIDES_META.description}`,
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
  const parts = prerenderPages().map((p) => {
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
