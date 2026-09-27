/// <reference types="node" />
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { buildSite, iconNamesUsed } from './src/app/seo/build';
import { SITE_NAME } from './src/app/site';

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

      const files = buildSite({
        template,
        iconSvg: (name) => icons.get(name) ?? '',
        assetsFor,
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
  plugins: [prerender(), pagesLikePreview()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
  worker: {
    format: 'es',
  },
});
