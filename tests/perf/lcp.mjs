// Largest Contentful Paint (LCP) of a first visit on a phone: loads pages of a built site with an empty
// cache through a throttled network and CPU, and reports when the largest element painted, which one
// it was, the render-blocking files, the main thread's long frames before LCP and the layout shift.
//
// Usage (needs the global `playwright` package, Chromium and openssl):
//   npm run build
//   NODE_PATH=$(npm root -g) node tests/perf/lcp.mjs [dist] [options]
// The site is served like GitHub Pages behind a CDN, as the live site is: folders, 404.html, HTTP/2
// (over TLS with a throwaway certificate) and gzip.
// Options:
//   --pages <a,b>   page paths (default: the pages field data names as the slowest, and the home page)
//   --runs <n>      loads per page; the report gives the worst and the median (default 3)
//   --cpu <n>       CPU slowdown (default 4; a mid-range phone)
//   --net <preset>  slow4g (DevTools "Slow 4G": 562.5 ms round trip, 1.6 Mbps down; default), fast4g, none
//   --width <px>    viewport width (default 390, DPR 3)
//   --waterfall     list the last load's files of each page with when they arrived
//   --sw            let the service worker install (it downloads the site for offline use after load)
//   --json <file>   also write every load's numbers as JSON
import { createRequire } from 'node:module';
import http2 from 'node:http2';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const require = createRequire(import.meta.url);
const lib = require('../e2e/textures/lib.cjs');
const { chromium } = require('playwright');

const argv = process.argv.slice(2);
const opt = (name, def) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : def);
const flag = (name) => argv.includes(`--${name}`);
const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && !['--waterfall', '--sw'].includes(argv[i - 1])));
const DIST = path.resolve(positional[0] ?? path.join(ROOT, 'dist'));
const PAGES = opt('pages', '/totem-maker/,/pt-br/textures/,/textures/,/es/guides/make-a-texture-pack/,/ja/texture-pack-converter/,/').split(',').filter(Boolean);
const RUNS = Number(opt('runs', '3'));
const CPU = Number(opt('cpu', '4'));
const WIDTH = Number(opt('width', '390'));
const WATERFALL = flag('waterfall');
const SW = flag('sw');
const JSON_OUT = opt('json', null);
const NETS = {
  slow4g: { latency: 562.5, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
  fast4g: { latency: 165, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 },
  none: null,
};
const NET = NETS[opt('net', 'slow4g')];
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error(`No built site in ${DIST}: run npm run build first.`);
  process.exit(2);
}

// ---------------------------------------------------------------------------------------- server
// DevTools network throttling leaves the navigation request alone: the page's HTML is held back here
// by one round trip and its transfer time instead.
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };
const certDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcp-cert-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(certDir, 'key.pem'), '-out', path.join(certDir, 'cert.pem'), '-days', '1', '-subj', '/CN=127.0.0.1'], { stdio: 'ignore' });
const gzCache = new Map();
const server = http2.createSecureServer({ key: fs.readFileSync(path.join(certDir, 'key.pem')), cert: fs.readFileSync(path.join(certDir, 'cert.pem')), allowHTTP1: true }, async (req, res) => {
  const url = new URL(req.url, 'https://x');
  const send = async (file, status = 200) => {
    const type = TYPES[path.extname(file)] ?? 'application/octet-stream';
    let body = await readFile(file);
    const headers = { 'content-type': type, 'cache-control': 'no-store' };
    if (/text|json|svg|xml|manifest/.test(type) && /gzip/.test(req.headers['accept-encoding'] ?? '')) {
      if (!gzCache.has(file)) gzCache.set(file, zlib.gzipSync(body, { level: 9 }));
      body = gzCache.get(file);
      headers['content-encoding'] = 'gzip';
    }
    if (NET && req.headers['sec-fetch-dest'] === 'document') await new Promise((r) => setTimeout(r, NET.latency + (body.length / NET.downloadThroughput) * 1000));
    res.writeHead(status, headers);
    res.end(body);
  };
  const p = decodeURIComponent(url.pathname);
  const file = path.join(DIST, path.normalize(p).replace(/^(\.\.[/\\])+/, ''));
  try {
    const st = await stat(file);
    if (st.isDirectory()) {
      if (!p.endsWith('/')) return void res.writeHead(301, { location: `${p}/${url.search}` }).end();
      return await send(path.join(file, 'index.html'));
    }
    return await send(file);
  } catch {
    try {
      await send(path.join(DIST, '404.html'), 404);
    } catch {
      res.writeHead(404).end();
    }
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `https://127.0.0.1:${server.address().port}`;

// ------------------------------------------------------------------------------- in-page recorder
function recorder() {
  const rec = { lcp: [], shifts: [], frames: [], marks: [] };
  window.__lcp = rec;
  const describe = (el) => {
    if (!(el instanceof Element)) return '';
    const chain = [];
    for (let e = el; e && e !== document.body && chain.length < 4; e = e.parentElement) {
      const cls = [...e.classList].slice(0, 2).join('.');
      chain.unshift(`${e.tagName.toLowerCase()}${cls ? '.' + cls : ''}`);
    }
    return chain.join('>');
  };
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) rec.lcp.push({ t: e.startTime, size: e.size, el: describe(e.element), url: e.url || '' });
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) rec.shifts.push(e.value);
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries())
        rec.frames.push({ t: e.startTime, dur: e.duration, block: e.blockingDuration, scripts: (e.scripts ?? []).map((s) => ({ dur: s.duration, what: `${s.invoker || s.type}${s.sourceFunctionName ? ` → ${s.sourceFunctionName}` : ''}`, url: (s.sourceURL || '').replace(/^.*\//, '') })) });
    }).observe({ type: 'long-animation-frame', buffered: true });
  } catch {}
  // when the app took the page over (the shell's outlet) and put its view in
  new MutationObserver((muts) => {
    for (const m of muts) if (m.target instanceof Element && m.target.id === 'main' && m.type === 'childList') rec.marks.push({ t: performance.now(), what: 'view in' });
  }).observe(document, { subtree: true, childList: true });
}

// ------------------------------------------------------------------------------------------ runs
const browser = await chromium.launch({ executablePath: lib.EXE, args: ['--ignore-certificate-errors', '--allow-insecure-localhost', ...(process.env.HTTPS_PROXY ? [`--proxy-server=${process.env.HTTPS_PROXY}`, '--proxy-bypass-list=127.0.0.1;localhost'] : [])] });
const results = [];
console.log(`LCP harness: ${WIDTH}px phone, CPU ${CPU}×, network ${opt('net', 'slow4g')}, ${DIST}`);
try {
  for (const pg of PAGES) {
    for (let run = 1; run <= RUNS; run++) {
      const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: UA, serviceWorkers: SW ? 'allow' : 'block', colorScheme: 'dark', ignoreHTTPSErrors: true });
      await ctx.addInitScript(recorder);
      const page = await ctx.newPage();
      page.setDefaultTimeout(90000);
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      if (NET) await cdp.send('Network.emulateNetworkConditions', { offline: false, ...NET });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(base + pg, { waitUntil: 'load', timeout: 90000 });
      // quiet for a while: the view that builds the page after load has run
      await page.waitForTimeout(4000);
      const data = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        const res = performance.getEntriesByType('resource').map((r) => ({ name: r.name.replace(location.origin, ''), start: r.startTime, end: r.responseEnd, size: r.encodedBodySize, blocking: r.renderBlockingStatus }));
        const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null;
        return { ...window.__lcp, ttfb: nav.responseStart, html: nav.responseEnd, dcl: nav.domContentLoadedEventEnd, fcp, res };
      });
      const last = data.lcp.at(-1);
      const cls = data.shifts.reduce((a, b) => a + b, 0);
      const r = {
        page: pg,
        run,
        lcp: last?.t ?? null,
        el: last?.el ?? '',
        candidates: data.lcp.map((c) => `${Math.round(c.t)} ${c.el}${c.url ? ` (${c.url.replace(/^.*\//, '')})` : ''} ${c.size}px²`),
        ttfb: data.ttfb,
        html: data.html,
        fcp: data.fcp,
        dcl: data.dcl,
        viewIn: data.marks.at(-1)?.t ?? null,
        cls,
        framesBefore: data.frames.filter((l) => last && l.t < last.t).map((l) => ({ t: Math.round(l.t), dur: Math.round(l.dur), top: l.scripts.sort((a, b) => b.dur - a.dur).slice(0, 2).map((s) => `${Math.round(s.dur)} ms ${s.what} ${s.url}`) })),
        blocking: data.res.filter((x) => x.blocking === 'blocking').map((x) => `${x.name} ${Math.round(x.end)} ms`),
        res: data.res,
        errors,
      };
      results.push(r);
      console.log(`  ${pg} run ${run}: LCP ${r.lcp == null ? '—' : Math.round(r.lcp)} ms  FCP ${Math.round(r.fcp ?? 0)}  HTML ${Math.round(r.html)}  DCL ${Math.round(r.dcl)}  view in ${r.viewIn == null ? '—' : Math.round(r.viewIn)}  CLS ${cls.toFixed(4)}  ${r.el}${errors.length ? `  errors: ${errors.join('; ')}` : ''}`);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  server.close();
  fs.rmSync(certDir, { recursive: true, force: true });
}

console.log(`\nLCP per page (worst / median of ${RUNS}), the worst load's candidates, render-blocking files and long frames before LCP`);
for (const pg of PAGES) {
  const rs = results.filter((r) => r.page === pg && r.lcp != null);
  const ms = rs.map((r) => r.lcp).sort((a, b) => a - b);
  const w = [...rs].sort((a, b) => b.lcp - a.lcp)[0];
  console.log(`${String(Math.round(ms.at(-1) ?? 0)).padStart(6)} (${String(Math.round(ms[Math.floor((ms.length - 1) / 2)] ?? 0)).padStart(5)})  ${pg}  CLS ${Math.max(0, ...rs.map((r) => r.cls)).toFixed(4)}`);
  if (!w) continue;
  for (const c of w.candidates) console.log(`          candidate ${c}`);
  for (const b of w.blocking) console.log(`          render-blocking ${b}`);
  for (const l of w.framesBefore.filter((x) => x.dur > 80)) console.log(`          long frame at ${l.t}: ${l.dur} ms  ${l.top.join('; ')}`);
  if (WATERFALL) {
    const last = rs.at(-1);
    for (const x of [...last.res].sort((a, b) => a.end - b.end)) console.log(`          ${String(Math.round(x.start)).padStart(5)} → ${String(Math.round(x.end)).padStart(5)}  ${String(x.size).padStart(7)} B  ${x.name}`);
  }
}
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(results, null, 2));
