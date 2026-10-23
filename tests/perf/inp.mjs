// Interaction to Next Paint (INP) on a phone or a tablet: drives realistic flows through the site with
// touch taps, finger strokes, typing and slider drags, records every interaction's latency with the
// Event Timing API (`event` entries, durationThreshold 16) and attributes the slow ones with
// long-animation-frame (LoAF) entries: which script / function ran, and how the time splits into input
// delay, processing (the event handlers) and presentation (style, layout, paint until the next frame).
//
// Usage (needs the global `playwright` package and Chromium; TO_FIXTURES as for the texture e2e suites,
// the texture flows create a Java 26.3 pack from its client jar):
//   npm run build
//   NODE_PATH=$(npm root -g) TO_FIXTURES=<dir> node tests/perf/inp.mjs [dist | baseUrl] [options]
// The first argument is a built site folder (served here like GitHub Pages; default `dist`) or the URL of
// a running server (e.g. a Vite dev server, slower than a build).
// Options:
//   --cpu <n>          CPU slowdown through the DevTools protocol (default 4; a mid-range phone; try 6)
//   --device <d>       phone (390 × 844, DPR 3; default) or tablet (820 × 1180, DPR 2)
//   --flows <a,b>      some of: home, start, editor, skins, shaders, converter, totem (default all)
//   --top <n>          rows in the slowest-interactions table (default 25)
//   --runs <n>         repeat every flow n times and report the worst / median of each step (default 1)
//   --json <file>      also write every step's numbers as JSON (to compare two builds)
//   --profile          sample the CPU during each step and list its hottest functions (an unminified
//                      build, `npx vite build --minify false`, gives readable names)
//   --only <regex>     report only the steps whose name matches (the others still run)
//   --until <regex>    end each flow after the first step whose name matches
//   --headed           show the browser
// With a build that has source maps (`npx vite build --sourcemap`), script positions are mapped back to
// the source files. Each step's latency is the slowest interaction it caused (a tap's pointerdown,
// pointerup and click are one interaction). Times are from headless Chromium with SwiftShader WebGL, so
// read them as relative: compare builds on the same machine.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const require = createRequire(import.meta.url);
const lib = require('../e2e/textures/lib.cjs');
const { startPagesServer } = await import('../e2e/seo/pages-server.mjs');

// ------------------------------------------------------------------------------------------ options
const argv = process.argv.slice(2);
const opt = (name, def) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : def);
const flag = (name) => argv.includes(`--${name}`);
const positional = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--') && !['--profile', '--headed'].includes(argv[i - 1])));
const target = positional[0] ?? path.join(ROOT, 'dist');
const CPU = Number(opt('cpu', '4'));
const DEVICE = opt('device', 'phone');
const TOP = Number(opt('top', '25'));
const RUNS = Number(opt('runs', '1'));
const JSON_OUT = opt('json', null);
const PROFILE = flag('profile');
const UNTIL = opt('until', null) ? new RegExp(opt('until', ''), 'i') : null;
const ONLY = opt('only', null) ? new RegExp(opt('only', ''), 'i') : null;
const ALL_FLOWS = ['home', 'start', 'editor', 'skins', 'shaders', 'converter', 'totem'];
const FLOWS = (opt('flows', ALL_FLOWS.join(',')) ?? '').split(',').filter(Boolean);
const DEVICES = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 },
  tablet: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2 },
};
const UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';

// ------------------------------------------------------------------------------------ source maps
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64I = Object.fromEntries([...B64].map((c, i) => [c, i]));
/** Decodes a v3 source map's mappings into per-line segment arrays [genCol, src, line, col]. */
function decodeMappings(map) {
  const lines = [];
  let src = 0;
  let sl = 0;
  let sc = 0;
  for (const line of map.mappings.split(';')) {
    const segs = [];
    let gc = 0;
    for (const seg of line.split(',')) {
      if (!seg) continue;
      const v = [];
      let shift = 0;
      let val = 0;
      for (const ch of seg) {
        const d = B64I[ch];
        val += (d & 31) << shift;
        if (d & 32) shift += 5;
        else {
          v.push(val & 1 ? -(val >>> 1) : val >>> 1);
          val = 0;
          shift = 0;
        }
      }
      gc += v[0];
      if (v.length >= 4) {
        src += v[1];
        sl += v[2];
        sc += v[3];
        segs.push([gc, src, sl, sc]);
      }
    }
    lines.push(segs);
  }
  return lines;
}
const mapCache = new Map();
/** For a built file's URL: its text and decoded map, when the served folder has them. */
function mapFor(url) {
  if (!DIST || !url) return null;
  if (mapCache.has(url)) return mapCache.get(url);
  let r = null;
  try {
    const rel = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, '');
    const file = path.join(DIST, rel);
    if (fs.existsSync(file + '.map')) {
      const map = JSON.parse(fs.readFileSync(file + '.map', 'utf8'));
      const text = fs.readFileSync(file, 'utf8');
      const starts = [0];
      for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
      r = { map, lines: decodeMappings(map), starts };
    }
  } catch {
    r = null;
  }
  mapCache.set(url, r);
  return r;
}
/** "src/x.ts:12" for a position in a built file (char offset, or line / column), else "file.js:pos". */
function where(url, { char, line, col } = {}) {
  if (!url) return '';
  const short = url.replace(/^.*\/assets\//, '').replace(/^https?:\/\/[^/]+\//, '');
  const m = mapFor(url);
  if (m) {
    if (char != null && char >= 0) {
      let lo = 0;
      let hi = m.starts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (m.starts[mid] <= char) lo = mid;
        else hi = mid - 1;
      }
      line = lo;
      col = char - m.starts[lo];
    }
    const segs = m.lines[line] ?? [];
    let best = null;
    for (const s of segs) if (s[0] <= col) best = s;
    if (best) return `${m.map.sources[best[1]].replace(/^.*?\b(src|node_modules)\//, '$1/')}:${best[2] + 1}`;
  }
  return `${short}:${char ?? `${(line ?? 0) + 1}:${col ?? 0}`}`;
}

// ------------------------------------------------------------------------------- in-page recorder
/** Installed before any page script: buffers event and long-animation-frame entries. */
function recorder() {
  const rec = { events: [], loafs: [] };
  window.__inp = rec;
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (!e.interactionId) continue;
        rec.events.push({ id: e.interactionId, name: e.name, start: e.startTime, dur: e.duration, ps: e.processingStart, pe: e.processingEnd, target: e.target ? describe(e.target) : '' });
      }
    }).observe({ type: 'event', durationThreshold: 16, buffered: true });
  } catch {}
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        rec.loafs.push({
          start: e.startTime,
          dur: e.duration,
          renderStart: e.renderStart,
          styleStart: e.styleAndLayoutStart,
          blocking: e.blockingDuration,
          scripts: e.scripts.map((s) => ({
            start: s.startTime,
            dur: s.duration,
            invoker: s.invoker,
            type: s.invokerType,
            fn: s.sourceFunctionName,
            url: s.sourceURL,
            char: s.sourceCharPosition,
            forced: s.forcedStyleAndLayoutDuration,
            pause: s.pauseDuration,
          })),
        });
      }
    }).observe({ type: 'long-animation-frame', buffered: true });
  } catch {}
  function describe(el) {
    if (!(el instanceof Element)) return '';
    const cls = [...el.classList].slice(0, 2).join('.');
    const label = el.getAttribute('aria-label') || el.getAttribute('data-v') || el.getAttribute('data-tool') || '';
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${label ? `[${label.slice(0, 24)}]` : ''}`;
  }
}

// ---------------------------------------------------------------------------------------- runner
let DIST = null;
let base = target;
let server = null;
if (!/^https?:/.test(target)) {
  DIST = path.resolve(target);
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error(`No built site in ${DIST}: run npm run build first, or pass a server URL.`);
    process.exit(2);
  }
  server = await startPagesServer({ dist: DIST });
  base = server.url;
}
if (!base.endsWith('/')) base += '/';

const fx = lib.fixturesDir();
const browser = await lib.launch();
const results = []; // { flow, step, run, ms, n, worst }

class Session {
  constructor(page, cdp, flow, run) {
    this.page = page;
    this.cdp = cdp;
    this.flow = flow;
    this.run = run;
  }
  async throttle(on = true) {
    await this.cdp.send('Emulation.setCPUThrottlingRate', { rate: on ? CPU : 1 });
  }
  /** Waits until no long animation frame has ended for `quiet` ms (at most `max`). */
  async settle(quiet = 400, max = 8000) {
    await this.page.evaluate(
      ([q, m]) =>
        new Promise((res) => {
          const t0 = performance.now();
          const tick = () => {
            const l = window.__inp.loafs.at(-1);
            const lastEnd = l ? l.start + l.dur : 0;
            const now = performance.now();
            if ((now - Math.max(lastEnd, t0) >= q && now - t0 >= q) || now - t0 > m) res();
            else setTimeout(tick, 50);
          };
          requestAnimationFrame(() => setTimeout(tick, 50));
        }),
      [quiet, max],
    );
  }
  /** Runs `fn` as the named step and records the slowest interaction it caused. */
  async step(name, fn, { quiet = 400 } = {}) {
    const page = this.page;
    try {
      await this.settle(250, 6000);
      const t0 = await page.evaluate(() => performance.now());
      if (PROFILE) await this.cdp.send('Profiler.start');
      await fn(page);
      await this.settle(quiet);
      // event entries are queued after the next paint: give them a moment
      await page.waitForTimeout(120);
      const prof = PROFILE ? (await this.cdp.send('Profiler.stop')).profile : null;
      const data = await page.evaluate((from) => {
        const r = window.__inp;
        return { events: r.events.filter((e) => e.start >= from - 1), loafs: r.loafs.filter((l) => l.start + l.dur >= from - 1) };
      }, t0);
      const byId = new Map();
      for (const e of data.events) {
        const cur = byId.get(e.id);
        if (!cur || e.dur > cur.dur) byId.set(e.id, { ...e, names: new Set([...(cur?.names ?? []), e.name]) });
        else cur.names.add(e.name);
      }
      const inter = [...byId.values()].sort((a, b) => b.dur - a.dur);
      const worst = inter[0] ?? null;
      let att = null;
      if (worst) att = attribute(worst, data.events.filter((e) => e.id === worst.id), data.loafs);
      // a long frame anywhere in the step delays whatever the user taps next
      const longest = data.loafs.reduce((m, l) => (l.blocking > (m?.blocking ?? 0) ? l : m), null);
      const blocker = longest && longest.dur > 200 ? { dur: Math.round(longest.dur), scripts: longest.scripts.sort((a, b) => b.dur - a.dur).slice(0, 2).map((sc) => `${Math.round(sc.dur)} ms ${sc.invoker || sc.type}${sc.fn ? ` → ${sc.fn}` : ''} ${where(sc.url, { char: sc.char })}`) } : null;
      const hot = prof ? hotFunctions(prof) : null;
      results.push({ flow: this.flow, step: name, run: this.run, ms: worst ? worst.dur : 0, n: inter.length, worst: worst && { target: worst.target, names: [...worst.names], ...att }, blocker, hot });
      process.stdout.write(`  ${worst ? String(Math.round(worst.dur)).padStart(4) : '  <16'} ms  ${this.flow} › ${name}${inter.length > 1 ? `  (${inter.length} interactions)` : ''}${blocker ? `  [long frame after it: ${blocker.dur} ms]` : ''}\n`);
    } catch (err) {
      if (PROFILE) await this.cdp.send('Profiler.stop').catch(() => {});
      console.log(`  SKIP ${this.flow} › ${name}: ${String(err.message).split('\n')[0]}`);
      results.push({ flow: this.flow, step: name, run: this.run, ms: null, n: 0, error: String(err.message).split('\n')[0] });
    }
    if (UNTIL?.test(name)) throw new Error('--until reached');
  }
  tap(sel) {
    return this.page.locator(sel).filter({ visible: true }).first().tap({ timeout: 8000 });
  }
  /** A finger stroke through screen points (Input.dispatchTouchEvent, as phone.e2e.cjs). */
  async stroke(points, stepMs = 16) {
    const [x0, y0] = points[0];
    await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] });
    for (const [x, y] of points.slice(1)) {
      await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
      if (stepMs) await this.page.waitForTimeout(stepMs);
    }
    await this.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  /** Drags a range input's thumb with a finger, from its value to `to` (0..1 of its width). */
  async slide(sel, to) {
    const box = await this.page.locator(sel).first().boundingBox();
    const val = await this.page.locator(sel).first().evaluate((el) => (Number(el.value) - Number(el.min || 0)) / ((Number(el.max || 100) - Number(el.min || 0)) || 1));
    const y = box.y + box.height / 2;
    const from = box.x + 8 + (box.width - 16) * val;
    const end = box.x + 8 + (box.width - 16) * to;
    const pts = [];
    for (let i = 0; i <= 8; i++) pts.push([from + ((end - from) * i) / 8, y]);
    await this.stroke(pts, 30);
  }
}

/** Phases of the slowest interaction, and the scripts of the animation frames it overlapped. */
function attribute(worst, entries, loafs) {
  // the phases of the interaction's slowest entry (a stroke's pointerdown and pointerup are far apart)
  const start = worst.start;
  const end = worst.start + worst.dur;
  const inputDelay = Math.max(0, worst.ps - start);
  const processing = Math.max(0, worst.pe - worst.ps);
  const presentation = Math.max(0, end - worst.pe);
  const over = loafs.filter((l) => l.start < end && l.start + l.dur > start);
  const scripts = [];
  let render = 0;
  for (const l of over) {
    if (l.renderStart) render += l.start + l.dur - l.renderStart;
    for (const s of l.scripts) {
      if (s.start + s.dur < start - 50 || s.start > end) continue;
      scripts.push({ dur: Math.round(s.dur), forced: Math.round(s.forced || 0), what: `${s.invoker || s.type}${s.fn ? ` → ${s.fn}` : ''}`, at: where(s.url, { char: s.char }) });
    }
  }
  scripts.sort((a, b) => b.dur - a.dur);
  return { inputDelay: Math.round(inputDelay), processing: Math.round(processing), presentation: Math.round(presentation), render: Math.round(render), scripts: scripts.slice(0, 4) };
}

/** Self time per function in a CPU profile, the top few, then the app's own functions by total time. */
function hotFunctions(profile) {
  const self = new Map();
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const keyOf = (cf) => `${cf.functionName || '(anonymous)'} ${cf.url ? where(cf.url, { line: cf.lineNumber, col: cf.columnNumber }) : ''}`;
  const total = new Map();
  const dt = profile.timeDeltas;
  for (let i = 0; i < profile.samples.length; i++) {
    const n = byId.get(profile.samples[i]);
    const cf = n.callFrame;
    if (['(idle)', '(program)', '(root)'].includes(cf.functionName)) continue;
    const ms = (dt[i + 1] ?? dt[i] ?? 0) / 1000;
    self.set(keyOf(cf), (self.get(keyOf(cf)) ?? 0) + ms);
    // every app function on the stack, once (recursion counted once)
    const seen = new Set();
    for (let id = n.id; id != null; id = parent.get(id)) {
      const k = keyOf(byId.get(id).callFrame);
      if (seen.has(k) || !k.includes(' src/')) continue;
      seen.add(k);
      total.set(k, (total.get(k) ?? 0) + ms);
    }
  }
  const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  return [...top(self, 5).map(([k, v]) => `${v.toFixed(0).padStart(5)} ms  ${k}`), ...top(total, 6).map(([k, v]) => `${v.toFixed(0).padStart(5)} ms  total in ${k}`)];
}

async function session(flow, run, body) {
  const ctx = await browser.newContext({ ...DEVICES[DEVICE], isMobile: true, hasTouch: true, userAgent: UA, serviceWorkers: 'block', colorScheme: 'light' });
  await lib.routeMojang(ctx, fx);
  // skin lookups by name and other outside requests: answer fast instead of waiting on the network
  await ctx.route(/^https:\/\/(api\.mojang\.com|sessionserver\.mojang\.com|textures\.minecraft\.net|mc-heads\.net|crafatar\.com)\//, (r) => r.fulfill({ status: 404, body: '' }));
  await ctx.addInitScript(recorder);
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', (e) => console.log(`  page error: ${e.message}`));
  const cdp = await ctx.newCDPSession(page);
  if (PROFILE) {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  }
  const s = new Session(page, cdp, flow, run);
  try {
    await body(s, page);
  } catch (err) {
    console.log(`  flow ${flow} stopped: ${String(err.message).split('\n')[0]}`);
  } finally {
    await ctx.close();
  }
}

// ------------------------------------------------------------------------------------------ flows
const phone = DEVICE === 'phone';

async function flowHome(s, page) {
  await page.goto(base);
  await page.waitForLoadState('load');
  await page.waitForTimeout(1500);
  await s.throttle();
  await s.step('tap theme toggle', () => s.tap('.theme-toggle'));
  await s.step('tap theme toggle back', () => s.tap('.theme-toggle'));
  if (await page.locator('.menu-btn').isVisible()) {
    await s.step('open site menu', () => s.tap('.menu-btn'));
    await s.step('close site menu', () => page.keyboard.press('Escape'));
  }
  await s.step('tap "Start creating" (to /textures/)', () => s.tap('a.btn-primary.btn-lg'));
  await page.waitForSelector('.tx-new');
  await s.step('back to home', () => page.goBack());
  await page.waitForTimeout(500);
  await s.step('tap Skins card', () => s.tap('a.tool-card.accent-blue'));
}

async function newPack(s, page) {
  await page.goto(base + 'textures/');
  await page.waitForSelector('.tx-new');
  await page.waitForTimeout(1200);
}

async function flowStart(s, page) {
  await newPack(s, page);
  await s.throttle();
  await s.step('tap name field', () => s.tap('.tx-name-field input'));
  await s.step('type pack name', () => page.keyboard.type('Perf', { delay: 60 }));
  await s.step('tap Bedrock', () => s.tap('.tx-new .segmented-item:nth-child(2)'));
  await s.step('tap Java', () => s.tap('.tx-new .segmented-item:nth-child(1)'));
  await s.step('tap 32× resolution', () => s.tap('.tx-res-chip:nth-child(2)'));
  await s.step('tap 16× resolution', () => s.tap('.tx-res-chip:nth-child(1)'));
  await s.step('tap PvP start', () => s.tap('.tx-start-opt[data-start="pvp"], .tx-start-opt:nth-child(2)'));
  await s.step('tap vanilla start', () => s.tap('.tx-start-opt:nth-child(1)'));
  await s.step('open version picker', () => s.tap('.vp-trigger'));
  await s.step('close version picker', () => page.keyboard.press('Escape'));
  await s.step('tap Create pack', () => s.tap('.tx-create-btn'), { quiet: 800 });
}

/** Waits until the editor is ready and idle (the texture list has loaded). */
async function editorReady(page) {
  await page.waitForURL(/textures\/[0-9a-f-]+\/?$/, { timeout: 30000 });
  await page.waitForSelector('.tx-main', { timeout: 120000 });
  await page.waitForSelector('.tx-pick', { timeout: 120000 });
  await page.waitForTimeout(6000);
}

async function flowEditor(s, page) {
  await newPack(s, page);
  await page.fill('.tx-name-field input', 'Perf');
  await page.locator('.tx-create-btn').tap();
  await editorReady(page);
  await s.throttle();
  const tab = (v) => s.tap(`.tx-tabbar-btn[data-v="${v}"]`);
  if (phone) {
    await s.step('tap quick pick: Grass block (first texture)', () => s.tap('.tx-pick'), { quiet: 800 });
    await s.step('tab: Textures', () => tab('textures'));
    await s.step('tap a texture in the list', () => s.tap('.tx-tile:nth-child(3)'), { quiet: 800 });
    if ((await page.locator('.tx-editor').getAttribute('data-mobile')) !== 'editor') await s.step('tab: Paint', () => tab('editor'));
  } else {
    await s.step('tap quick pick: Grass block (first texture)', () => s.tap('.tx-pick'), { quiet: 800 });
    await s.step('tap a texture in the list', () => s.tap('.tx-tile:nth-child(3)'), { quiet: 800 });
  }
  await page.waitForSelector('.tx-canvas-host canvas');
  await s.step('tool: fill', () => s.tap('.tx-tool[data-tool="fill"]'));
  await s.step('tool: pencil', () => s.tap('.tx-tool[data-tool="pencil"]'));
  const box = await page.locator('.tx-canvas-host canvas').first().boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const r = Math.min(box.width, box.height) * 0.35;
  await s.step('paint: tap a pixel', () => s.stroke([[cx, cy]]));
  await s.step('paint: stroke', () => {
    const pts = [];
    for (let i = 0; i <= 20; i++) pts.push([cx - r + (2 * r * i) / 20, cy - r / 2 + Math.sin(i / 3) * r * 0.3]);
    return s.stroke(pts);
  });
  await s.step('paint: second stroke', () => {
    const pts = [];
    for (let i = 0; i <= 20; i++) pts.push([cx - r / 2 + Math.cos(i / 4) * r * 0.4, cy - r + (2 * r * i) / 20]);
    return s.stroke(pts);
  });
  await s.step('undo', () => s.tap('.tx-undo, button[aria-label^="Undo"]'));
  await s.step('redo', () => s.tap('.tx-redo, button[aria-label^="Redo"]'));
  await s.step('tool: eraser', () => s.tap('.tx-tool[data-tool="eraser"]'));
  await s.step('tool: fill → tap', async () => {
    await s.tap('.tx-tool[data-tool="fill"]');
  });
  await s.step('paint: fill tap', () => s.stroke([[cx + r / 2, cy + r / 2]]));
  await s.step('tool: eyedropper', () => s.tap('.tx-tool[data-tool="picker"], .tx-tool[data-tool="eyedropper"]'));
  await s.step('tool: pencil again', () => s.tap('.tx-tool[data-tool="pencil"]'));
  await s.step('swap colours', () => s.tap('.tx-swap'));
  await s.step('tap a palette colour', () => s.tap('.tx-pal-row .tx-pal'));
  await s.step('open colour picker', () => s.tap('.tx-swatch-primary'));
  const pickerOpen = await page.locator('.modal, [role="dialog"], .popover').first().isVisible().catch(() => false);
  if (pickerOpen) {
    const sv = page.locator('.cp-sv, .cp-area, [class*="sv"]').first();
    const b = await sv.boundingBox().catch(() => null);
    if (b) await s.step('colour picker: drag', () => s.stroke([[b.x + b.width * 0.2, b.y + b.height * 0.3], [b.x + b.width * 0.4, b.y + b.height * 0.4], [b.x + b.width * 0.6, b.y + b.height * 0.5]], 30));
    await s.step('close colour picker', () => page.keyboard.press('Escape'));
  }
  await s.step('pinch zoom', async () => {
    const t = (pts) => pts.map(([x, y], i) => ({ x, y, id: i + 1 }));
    await s.cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: t([[cx - 30, cy], [cx + 30, cy]]) });
    for (let i = 1; i <= 6; i++) {
      await s.cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: t([[cx - 30 - i * 10, cy], [cx + 30 + i * 10, cy]]) });
      await page.waitForTimeout(16);
    }
    await s.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  });
  await s.step('texture menu', () => s.tap('.tx-head-actions .icon-btn:last-child'));
  await s.step('texture menu: Fit', () => s.tap('[role="menu"] [role="menuitem"]:nth-child(3)'));
  await s.step('layers: open panel', () => s.tap('.tx-pl-btn'));
  await s.step('layers: add layer', () => s.tap('.tx-pl-add'));
  await s.step('layers: hide a layer', () => s.tap('.tx-plr-eye'));
  await s.step('layers: undo', () => s.tap('button[aria-label^="Undo"]'));
  await s.step('layers: close', () => s.tap('.tx-pl-close'));
  await s.step('grid toggle', () => s.tap('.tx-optgroup-view .icon-btn:nth-child(1)'));
  if (phone) {
    for (const v of ['preview', 'material', 'effects', 'pvp', 'pack', 'textures', 'editor']) await s.step(`tab: ${v}`, () => tab(v), { quiet: 600 });
    await s.step('tab: Effects (again)', () => tab('effects'));
  }
  await s.step('effects: tap a preset', () => s.tap('.tx-preset:nth-child(2)'), { quiet: 800 });
  if (phone) await s.step('tab: Textures after effect', () => tab('textures'), { quiet: 800 });
  if (phone) await s.step('library: All textures', () => s.tap('.tx-libbar [data-value="textures"]'), { quiet: 800 });
  await s.step('library: tap a texture', () => s.tap('.tx-browser .tx-tile:nth-child(5)'), { quiet: 800 });
  if (phone) await s.step('tab: Textures (back)', () => tab('textures'), { quiet: 600 });
  await s.step('library: category menu', () => s.tap('.tx-catpick'));
  await s.step('library: pick a category', () => s.tap('.tx-catmenu-item:nth-child(3)'), { quiet: 600 });
  await s.step('library: search typing', async () => {
    await s.tap('.tx-search-input');
    await page.keyboard.type('stone', { delay: 80 });
  }, { quiet: 600 });
  await s.step('library: clear search', () => s.tap('.tx-search-clear'));
  await s.step('library: list view', () => s.tap('.tx-seg .icon-btn:nth-child(2)'), { quiet: 600 });
  await s.step('library: grid view', () => s.tap('.tx-seg .icon-btn:nth-child(1)'), { quiet: 600 });
  await s.step('export dialog', () => s.tap('.tx-export-btn'), { quiet: 600 });
  await s.step('close export dialog', () => page.keyboard.press('Escape'));
}

async function flowSkins(s, page) {
  await page.goto(base + 'skins/');
  await page.waitForLoadState('load');
  await page.waitForTimeout(1500);
  await s.throttle();
  await s.step('tap a starter skin', () => s.tap('.sk-starter-explorer, .sk-starter'), { quiet: 1000 });
  await page.waitForSelector('.sk-editor .pc-root', { timeout: 30000 });
  await page.waitForTimeout(1500);
  const cv = page.locator('.sk-editor .pc-root canvas').first();
  const b = await cv.boundingBox();
  if (b) {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 3;
    await s.step('paint: tap', () => s.stroke([[cx, cy]]));
    await s.step('paint: stroke', () => s.stroke(Array.from({ length: 16 }, (_, i) => [cx - 40 + i * 5, cy + Math.sin(i / 2) * 10])));
  }
  await s.step('undo', () => s.tap('button[aria-label^="Undo"]'));
  for (const sel of ['.sk-editor .tx-tool:nth-child(2), .sk-editor [data-tool]:nth-child(2)', '.sk-editor .tx-tool:nth-child(1), .sk-editor [data-tool]:nth-child(1)']) await s.step(`tool ${sel.split(',')[0].slice(-14)}`, () => s.tap(sel));
  const tabs = await page.locator('.editor-tab').count();
  for (let i = 0; i < tabs; i++) {
    const label = (await page.locator('.editor-tab').nth(i).textContent())?.trim() || String(i);
    await s.step(`tab: ${label}`, () => page.locator('.editor-tab').nth(i).tap(), { quiet: 800 });
  }
  if (tabs) await s.step('tab: back to first', () => page.locator('.editor-tab').first().tap());
}

async function flowShaders(s, page) {
  await page.goto(base + 'shaders/');
  await page.waitForLoadState('load');
  await page.waitForTimeout(1500);
  await s.throttle();
  const create = page.locator('.sh-create-btn, .sh-new .btn-primary, button.btn-primary').first();
  await s.step('create a shader pack', () => create.tap(), { quiet: 1200 });
  await page.waitForTimeout(3000);
  const ranges = page.locator('input[type="range"]:visible');
  const n = Math.min(await ranges.count(), 3);
  for (let i = 0; i < n; i++) {
    const sel = `input[type="range"]:visible >> nth=${i}`;
    await s.step(`slider ${i + 1}: drag`, () => s.slide(sel, i % 2 ? 0.2 : 0.8));
  }
  const tabs = await page.locator('.editor-tab').count();
  for (let i = 0; i < tabs; i++) await s.step(`tab ${i + 1}`, () => page.locator('.editor-tab').nth(i).tap(), { quiet: 800 });
  const presets = page.locator('.sh-preset, [data-preset]');
  if (await presets.count()) await s.step('tap a preset', () => presets.nth(1).tap(), { quiet: 800 });
}

async function flowConverter(s, page) {
  await page.goto(base + 'texture-pack-converter/');
  await page.waitForLoadState('load');
  await page.waitForTimeout(1500);
  await s.throttle();
  const seg = page.locator('.segmented-item:visible');
  if (await seg.count()) {
    await s.step('tap direction 2', () => seg.nth(1).tap());
    await s.step('tap direction 1', () => seg.nth(0).tap());
  }
  if (await page.locator('.menu-btn').isVisible()) {
    await s.step('open site menu', () => s.tap('.menu-btn'));
    await s.step('close site menu', () => page.keyboard.press('Escape'));
  }
}

async function flowTotem(s, page) {
  await page.goto(base + 'totem-maker/');
  await page.waitForLoadState('load');
  await page.waitForTimeout(2500);
  await s.throttle();
  const btns = page.locator('main button:visible');
  const n = Math.min(await btns.count(), 6);
  for (let i = 0; i < n; i++) {
    const label = ((await btns.nth(i).getAttribute('aria-label')) || (await btns.nth(i).textContent()) || '').trim().slice(0, 30);
    await s.step(`tap "${label}"`, () => btns.nth(i).tap(), { quiet: 600 });
    if (await page.locator('[role="dialog"]:visible').count()) await page.keyboard.press('Escape');
  }
}

const FLOW_FNS = { home: flowHome, start: flowStart, editor: flowEditor, skins: flowSkins, shaders: flowShaders, converter: flowConverter, totem: flowTotem };

// ------------------------------------------------------------------------------------------- main
console.log(`INP harness: ${DEVICE}, CPU ${CPU}× slower, ${base}${fx ? '' : '  (no TO_FIXTURES: the texture editor flows need the game files)'}`);
try {
  for (let run = 1; run <= RUNS; run++) {
    for (const f of FLOWS) {
      if (!FLOW_FNS[f]) {
        console.log(`unknown flow ${f}`);
        continue;
      }
      console.log(`\n${f}${RUNS > 1 ? ` (run ${run})` : ''}`);
      await session(f, run, FLOW_FNS[f]);
    }
  }
} finally {
  await browser.close();
  await server?.close();
}

// -------------------------------------------------------------------------------------- reporting
const groups = new Map();
for (const r of results) {
  const k = `${r.flow} › ${r.step}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r);
}
const rows = [...groups.entries()]
  .filter(([k]) => !ONLY || ONLY.test(k))
  .map(([k, rs]) => {
    const ok = rs.filter((r) => r.ms != null);
    const ms = ok.map((r) => r.ms).sort((a, b) => a - b);
    const worst = ok.sort((a, b) => b.ms - a.ms)[0];
    return { k, max: ms.at(-1) ?? null, med: ms.length ? ms[Math.floor((ms.length - 1) / 2)] : null, worst };
  })
  .filter((r) => r.max != null);
rows.sort((a, b) => b.max - a.max);
const all = results.filter((r) => r.ms != null).map((r) => r.ms).sort((a, b) => a - b);
const p75 = all.length ? all[Math.min(all.length - 1, Math.floor(all.length * 0.75))] : 0;
const p98 = all.length ? all[Math.min(all.length - 1, Math.floor(all.length * 0.98))] : 0;
console.log(`\nSlowest interactions (${DEVICE}, CPU ${CPU}×; step latency = its slowest interaction; ID / proc / pres = input delay / processing / presentation)`);
console.log(`${'ms'.padStart(5)}${RUNS > 1 ? ' (med)' : ''}  ${'ID'.padStart(4)} ${'proc'.padStart(4)} ${'pres'.padStart(4)}  step  →  top scripts`);
for (const r of rows.slice(0, TOP)) {
  const w = r.worst.worst;
  console.log(
    `${String(Math.round(r.max)).padStart(5)}${RUNS > 1 ? ` (${String(Math.round(r.med)).padStart(3)})` : ''}  ${String(w?.inputDelay ?? '').padStart(4)} ${String(w?.processing ?? '').padStart(4)} ${String(w?.presentation ?? '').padStart(4)}  ${r.k}${w?.target ? `  [${w.target}]` : ''}`,
  );
  for (const sc of w?.scripts ?? []) console.log(`${' '.repeat(26)}${String(sc.dur).padStart(4)} ms${sc.forced ? ` (forced layout ${sc.forced})` : ''}  ${sc.what}  ${sc.at}`);
  if (w && w.render > 30) console.log(`${' '.repeat(26)}${String(w.render).padStart(4)} ms  rendering (style, layout, paint)`);
  if (r.worst.blocker) console.log(`${' '.repeat(26)}long frame in the step: ${r.worst.blocker.dur} ms (${r.worst.blocker.scripts.join('; ')})`);
  if (PROFILE && r.worst.hot) for (const hline of r.worst.hot) console.log(`${' '.repeat(26)}${hline}`);
}
const over200 = rows.filter((r) => r.max > 200).length;
console.log(`\n${all.length} steps measured; p75 ${Math.round(p75)} ms, p98 ${Math.round(p98)} ms, worst ${Math.round(all.at(-1) ?? 0)} ms; ${over200} step(s) over 200 ms.`);
const skipped = results.filter((r) => r.ms == null);
if (skipped.length) console.log(`${skipped.length} step(s) skipped: ${skipped.map((r) => `${r.flow} › ${r.step}`).join('; ')}`);
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ device: DEVICE, cpu: CPU, base, results }, null, 2));
