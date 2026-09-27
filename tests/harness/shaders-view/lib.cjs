// Shared Playwright helpers for the Shader Maker harness scripts and E2E tests.
// Run scripts with NODE_PATH=$(npm root -g) so the global 'playwright' package resolves.
// Screenshots go to $SHOTS_DIR (default: <tmp>/shaders-view-screens).
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const EXE = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find((p) => fs.existsSync(p));

async function launch() {
  return chromium.launch({
    executablePath: EXE,
    args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
}

/** New context with a theme, viewport and a pre-seeded theme preference (no flash). */
async function newContext(browser, { width = 1440, height = 900, theme = 'dark', dpr = 1, acceptDownloads = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, colorScheme: theme, acceptDownloads });
  await ctx.addInitScript((t) => {
    try {
      localStorage.setItem('to-theme', t);
    } catch {}
  }, theme);
  return ctx;
}

function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

/** Waits until the preview canvas has drawn something that isn't a flat colour. */
async function waitForCanvasPixels(page, selector = '.sh-stage-host canvas', timeout = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const stats = await page.evaluate(async (sel) => {
      const c = document.querySelector(sel);
      if (!c || !c.width) return null;
      // copy through a 2D canvas right after the next frame
      await new Promise((r) => requestAnimationFrame(() => r()));
      const tmp = document.createElement('canvas');
      tmp.width = 64;
      tmp.height = 40;
      const ctx = tmp.getContext('2d');
      ctx.drawImage(c, 0, 0, 64, 40);
      const d = ctx.getImageData(0, 0, 64, 40).data;
      let min = 255;
      let max = 0;
      const seen = new Set();
      for (let i = 0; i < d.length; i += 4) {
        const l = Math.round((d[i] + d[i + 1] + d[i + 2]) / 3);
        min = Math.min(min, l);
        max = Math.max(max, l);
        seen.add(l >> 3);
      }
      return { min, max, levels: seen.size };
    }, selector);
    // a drawn scene has a real spread of brightness (also for black & white looks)
    if (stats && stats.max - stats.min > 40 && stats.levels > 8) return stats;
    await page.waitForTimeout(500);
  }
  throw new Error('preview canvas stayed blank');
}

function outDir() {
  const d = process.env.SHOTS_DIR || path.join(require('os').tmpdir(), 'shaders-view-screens');
  fs.mkdirSync(d, { recursive: true });
  return d;
}

function shotPath(name) {
  return path.join(outDir(), `shaders-view-${name}.png`);
}

module.exports = { launch, newContext, collectErrors, waitForCanvasPixels, shotPath, EXE };
