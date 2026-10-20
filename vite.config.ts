/// <reference types="node" />
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { buildSite, iconNamesUsed } from './src/app/seo/build';
import { SITE_NAME } from './src/app/site';
import { buildInfo } from './src/pwa/sw-logic';

// Relative base so the same build works at a domain root (https://texturepackmaker.com/), under a
// GitHub Pages project path or in a test server. Pages use real paths (History API routing); the
// router works out the site root at runtime.

/**
 * Writes a static HTML page per public route (content, head tags, structured data), 404.html (boots
 * the app for private project URLs), sitemap.xml, robots.txt, llms.txt and llms-full.txt.
 * The page content comes from the same markup trees the app renders (src/app/seo/pages.ts).
 */
function prerender(): Plugin {
  let root = '';
  return {
    name: 'texturepackmaker:prerender',
    enforce: 'post',
    configResolved(config) {
      root = config.root.replace(/\/+$/, '');
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        // The dev server has no prerendered pages; the app renders everything.
        if (ctx.server) return html.replace('<!--app-head-->', `<title>${SITE_NAME}</title>`);
        return html;
      },
    },
    generateBundle: {
      order: 'post',
      async handler(_options, bundle) {
      const index = bundle['index.html'];
      if (!index || index.type !== 'asset') return;
      const template = typeof index.source === 'string' ? index.source : new TextDecoder().decode(index.source);

      const icons = new Map<string, string>();
      for (const name of iconNamesUsed()) {
        const svg = await this.fs.readFile(`${root}/node_modules/pixelarticons/svg/${name}.svg`, { encoding: 'utf8' });
        const inner = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(svg)?.[1]?.trim();
        if (!inner) this.error(`Icon "${name}" has no SVG content`);
        icons.set(name, inner);
      }

      const chunks = Object.values(bundle).filter((f) => f.type === 'chunk');
      const assetsFor = (modules: string[]) => {
        const css = new Set<string>();
        const js = new Set<string>();
        const seen = new Set<string>();
        const visit = (fileName: string, preload: boolean) => {
          if (seen.has(fileName)) return;
          seen.add(fileName);
          const chunk = chunks.find((c) => c.fileName === fileName);
          // The entry chunk and its CSS are already in the page template.
          if (!chunk || chunk.type !== 'chunk' || chunk.isEntry) return;
          if (preload) js.add(chunk.fileName);
          chunk.viteMetadata?.importedCss.forEach((f) => css.add(f));
          chunk.imports.forEach((f) => visit(f, preload));
        };
        for (const mod of modules) {
          const id = `${root}/${mod}`;
          const chunk = chunks.find((c) => c.type === 'chunk' && c.facadeModuleId === id);
          if (!chunk) this.error(`No chunk for ${mod}`);
          visit(chunk.fileName, true);
        }
        return { css: [...css], js: [...js] };
      };

      const assetFile = (source: string): string => {
        const asset = Object.values(bundle).find((f) => f.type === 'asset' && (f.originalFileNames ?? []).some((n) => n === source || n === `${root}/${source}`));
        if (!asset) this.error(`No built file for ${source}`);
        return asset.fileName;
      };

      const files = buildSite({
        template,
        iconSvg: (name) => icons.get(name) ?? '',
        assetsFor,
        assetFile,
        buildDate: new Date().toISOString().slice(0, 10),
      });
      for (const f of files) {
        if (f.fileName === 'index.html') index.source = f.source;
        else this.emitFile({ type: 'asset', fileName: f.fileName, source: f.source });
      }
      },
    },
  };
}

/**
 * Builds the service worker (src/pwa/sw.ts) as sw.js at the site root, so its scope is the whole
 * site, and writes this build's precache list into it: every file the worker caches at install,
 * with a content hash, and the app's entry script. Runs after the prerender plugin, so the pages
 * it writes are in the bundle too; files from public/ are read from disk.
 */
function serviceWorker(): Plugin {
  let root = '';
  let publicDir = '';
  const SW = 'sw.js';
  const hash = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex').slice(0, 12);
  const walk = (dir: string): string[] =>
    existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)])) : [];
  return {
    name: 'texturepackmaker:service-worker',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      root = config.root;
      publicDir = config.publicDir;
    },
    buildStart() {
      this.emitFile({ type: 'chunk', id: resolve(root, 'src/pwa/sw.ts'), fileName: SW });
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const sw = bundle[SW];
        if (!sw || sw.type !== 'chunk') return this.error('The service worker chunk is missing');
        // A classic worker script: it must not share code with the app (that would add imports).
        if (sw.imports.length || sw.dynamicImports.length) this.error(`sw.js imports other chunks (${sw.imports.join(', ')}): keep src/pwa/sw-logic.ts free of app imports`);
        const files = new Map<string, string>();
        for (const file of walk(publicDir)) files.set(relative(publicDir, file).split(sep).join('/'), hash(readFileSync(file)));
        let entry = '';
        for (const f of Object.values(bundle)) {
          if (f.fileName === SW) continue;
          files.set(f.fileName, hash(f.type === 'chunk' ? f.code : f.source));
          if (f.type === 'chunk' && f.isEntry && f.name === 'index') entry = f.fileName;
        }
        if (!entry) this.error('No app entry chunk found for the service worker');
        const info = buildInfo(files, entry);
        // Loaded as a classic script: its top-level names go in a function scope.
        sw.code = `self.__TPM_SW_BUILD__=${JSON.stringify(info)};\n(() => {\n${sw.code}\n})();\n`;
      },
    },
  };
}

/**
 * `vite preview` behaves like GitHub Pages: unknown page paths (private project URLs such as
 * /shaders/<id>) get 404.html instead of the SPA fallback. The fallback would serve index.html,
 * whose relative asset paths break on nested URLs.
 */
function pagesLikePreview(): Plugin {
  return {
    name: 'texturepackmaker:pages-preview',
    configurePreviewServer(server) {
      const outDir = resolve(server.config.root, server.config.build.outDir);
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        let rel: string;
        try {
          rel = decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/^\/+/, '');
        } catch {
          return next();
        }
        const file = join(outDir, rel);
        if (!file.startsWith(outDir) || extname(rel)) return next();
        if (existsSync(file) && statSync(file).isFile()) return next();
        if (existsSync(join(file, 'index.html'))) {
          if (rel === '' || rel.endsWith('/')) return next();
          // GitHub Pages redirects section folders to their trailing-slash URL
          res.statusCode = 301;
          res.setHeader('Location', `/${rel}/${(req.url ?? '').includes('?') ? `?${(req.url ?? '').split('?')[1]}` : ''}`);
          res.end();
          return;
        }
        const page = join(outDir, '404.html');
        if (!existsSync(page)) return next();
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(readFileSync(page));
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [prerender(), serviceWorker(), pagesLikePreview()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
  worker: {
    format: 'es',
  },
});
