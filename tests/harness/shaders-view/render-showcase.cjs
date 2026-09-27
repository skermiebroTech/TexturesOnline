// Renders the start-screen pictures of the three targets with the real live preview (procedural
// textures only, no game art) and writes them to src/tools/shaders/ui/showcase/<target>.webp.
// Needs the Vite dev server (it imports the source modules directly).
// Usage: NODE_PATH=$(npm root -g) node tests/harness/shaders-view/render-showcase.cjs <devServerUrl> [outDir]
const fs = require('fs');
const path = require('path');
const { launch, newContext } = require('./lib.cjs');

const base = (process.argv[2] || 'http://127.0.0.1:5733/').replace(/\/?$/, '/');
const outDir = process.argv[3] || path.resolve(__dirname, '../../../src/tools/shaders/ui/showcase');

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await launch();
  const ctx = await newContext(browser, { width: 1400, height: 900 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto(base + '#/help', { waitUntil: 'networkidle' });
  const images = await page.evaluate(async () => {
    const { TARGETS } = await import('/src/tools/shaders/targets.ts');
    const { presetSettings } = await import('/src/tools/shaders/ui/generator.ts');
    const { createShaderPreview } = await import('/src/shared/preview/shader-preview.ts');
    // the preview's bloom and haze depend on resolution: render at the size the picture is shown
    const W = 768;
    const H = 480;
    const host = document.createElement('div');
    host.style.cssText = `position:fixed;left:0;top:0;width:${W}px;height:${H}px;z-index:99999`;
    document.body.appendChild(host);
    const out = {};
    const first = await TARGETS[0].load();
    const preview = createShaderPreview(host, { autoRotate: false, pixelRatio: 1, params: first.toPreviewParams(first.defaults()) });
    await preview.setAssets(null);
    for (const t of TARGETS) {
      const gen = await t.load();
      const params = { ...gen.toPreviewParams(presetSettings(gen, t.showcase.preset)), timeOfDay: t.showcase.timeOfDay };
      preview.setParams(params);
      await new Promise((r) => setTimeout(r, 200));
      const shot = await preview.screenshot();
      const bmp = await createImageBitmap(shot);
      const c = document.createElement('canvas');
      c.width = 768;
      c.height = 480;
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(bmp, 0, 0, 768, 480);
      out[t.id] = c.toDataURL('image/webp', 0.84);
    }
    preview.destroy();
    host.remove();
    return out;
  });
  for (const [id, url] of Object.entries(images)) {
    const file = path.join(outDir, `${id}.webp`);
    fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    console.log(file, fs.statSync(file).size);
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
