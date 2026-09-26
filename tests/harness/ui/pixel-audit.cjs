// Pixel-grid audit: every visible text run must start on a whole device pixel and use an on-grid font size.
// Usage: NODE_PATH=$(npm root -g) node tests/harness/ui/pixel-audit.cjs <baseUrl> [widths=1280,1281,1440,1903] [dprs=1] [routes=/,/help]
// Env: V=1 prints offending runs, N=<max samples>, REL=<selector> measures relative to the closest ancestor.
const { chromium } = require('playwright');
const fs = require('fs');
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const base = process.argv[2];
const widths = (process.argv[3] || '1280,1281,1440,1903').split(',').map(Number);
const dprs = (process.argv[4] || '1').split(',').map(Number);
const routes = (process.argv[5] || '/,/help').split(',');
let failed = false;
(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  for (const dpr of dprs) for (const w of widths) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: dpr, colorScheme: 'dark', reducedMotion: 'reduce' });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => r.abort('internetdisconnected'));
    const page = await ctx.newPage();
    for (const r of routes) {
      await page.goto(base + '#' + r, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(600);
      const res = await page.evaluate(([REL, LIMIT]) => {
        const dpr = devicePixelRatio;
        const frac = (v) => Math.abs(v * dpr - Math.round(v * dpr)) > 0.02;
        const out = { runs: 0, badX: 0, badY: 0, badSize: 0, badLS: 0, samples: [] };
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walker.nextNode())) {
          if (!n.textContent.trim()) continue;
          const el = n.parentElement;
          if (!el || el.closest('[aria-hidden="true"] canvas, .kit-type-row, .hero-block')) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.display === 'none') continue;
          const range = document.createRange();
          range.selectNodeContents(n);
          const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.bottom > 0 && r.top < innerHeight * 6);
          if (!rects.length) continue;
          const fs = parseFloat(cs.fontSize);
          const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing);
          const pxSize = fs / 8; // CSS px per font pixel
          const anc = REL ? el.closest(REL) : null;
          const ar = anc ? anc.getBoundingClientRect() : { left: 0, top: 0 };
          for (const r of rects) {
            out.runs++;
            const bx = frac(r.left - ar.left), by = frac(r.top - ar.top), bs = frac(pxSize), bl = frac(ls) || (ls && Math.abs(ls / pxSize - Math.round(ls / pxSize)) > 0.01);
            if (bx) out.badX++;
            if (by) out.badY++;
            if (bs) out.badSize++;
            if (bl) out.badLS++;
            if ((bx || by || bs || bl) && out.samples.length < LIMIT) {
              const path = [];
              let e = el;
              for (let i = 0; e && i < 3; i++, e = e.parentElement) path.unshift(e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''));
              out.samples.push(`${path.join('>')} "${n.textContent.trim().slice(0, 24)}" x=${r.left.toFixed(2)} y=${r.top.toFixed(2)} fs=${fs} ls=${ls}${bx ? ' X' : ''}${by ? ' Y' : ''}${bs ? ' S' : ''}${bl ? ' L' : ''}`);
            }
          }
        }
        return out;
      }, [process.env.REL || '', Number(process.env.N || 12)]);
      if (res.badX || res.badY || res.badSize || res.badLS) failed = true;
      console.log(`dpr ${dpr} w ${w} ${r}: runs ${res.runs} badX ${res.badX} badY ${res.badY} badSize ${res.badSize} badLS ${res.badLS}`);
      if (process.env.V) res.samples.forEach((s) => console.log('   ', s));
    }
    await ctx.close();
  }
  await browser.close();
  if (failed && process.env.STRICT) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
