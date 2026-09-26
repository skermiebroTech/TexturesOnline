// Regression checks for the review fixes (render-on-demand skin preview, CSS background colours, colour
// management, no-WebGL block fallback, device pixel ratio changes, asset reuse, legacy water).
// Usage: NODE_PATH=$(npm root -g) node tests/harness/preview/check-review.cjs <baseUrl> <outDir>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const [base = 'http://localhost:5317', outDir = '.'] = process.argv.slice(2);
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find((p) => fs.existsSync(p));
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
};

(async () => {
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  // expected noise: the forced no-WebGL page, and the favicon request of the harness pages
  const expected = (t) => /Error creating WebGL context|status of 404/.test(t);
  const watch = (page) => {
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !expected(m.text())) errors.push(m.text()); });
  };

  // ---- skin preview ----
  let page = await browser.newPage({ viewport: { width: 1000, height: 520 } });
  watch(page);
  await page.goto(`${base}/tests/harness/preview/skin.html?assets=java&anim=none`);
  await page.evaluate(() => window.__ready);
  check('three colour management left enabled after creating skin previews', await page.evaluate(() => window.__colorManagement()));
  const loop = await page.evaluate(() => {
    const a = window.__a;
    const v = a.viewer;
    let renders = 0;
    const orig = v.render.bind(v);
    v.render = () => { renders++; orig(); };
    window.__renders = () => renders;
    return { paused: v.renderPaused };
  });
  check('static pose (animation none) does not run a render loop', loop.paused === true);
  await page.waitForTimeout(300);
  const idleRenders = await page.evaluate(() => window.__renders());
  check('no renders while idle', idleRenders === 0, `${idleRenders}`);
  const box = await page.locator('#a canvas').boundingBox();
  await page.mouse.move(box.x + 150, box.y + 200);
  await page.mouse.down();
  for (let i = 1; i <= 5; i++) await page.mouse.move(box.x + 150 + i * 15, box.y + 200);
  await page.mouse.up();
  const dragRenders = await page.evaluate(() => window.__renders());
  check('camera drag renders on demand', dragRenders >= 3, `${dragRenders}`);
  const anim = await page.evaluate(async () => {
    window.__a.setAnimation('walk');
    const running = !window.__a.viewer.renderPaused;
    window.__a.setAnimation('none');
    window.__a.setAutoRotate(true);
    const rotating = !window.__a.viewer.renderPaused;
    window.__a.setAutoRotate(false);
    return { running, rotating, pausedAgain: window.__a.viewer.renderPaused };
  });
  check('animation / auto-rotate start the loop, stopping them pauses it', anim.running && anim.rotating && anim.pausedAgain, JSON.stringify(anim));
  const bg = await page.evaluate(() => {
    const a = window.__a;
    document.getElementById('a').style.setProperty('--panel', '#336699');
    // stored components are the sRGB bytes / 255 (the scene renders to a linear target with no conversion)
    const hex = () => {
      const c = a.viewer.background;
      return c ? [c.r, c.g, c.b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('') : null;
    };
    const out = {};
    a.setBackground('var(--panel)');
    out.cssVar = hex();
    a.setBackground('hsl(0 100% 50%)');
    out.hsl = hex();
    a.setBackground('not-a-colour');
    out.invalid = a.viewer.background;
    a.setBackground('var(--undefined-token)');
    out.undefinedVar = a.viewer.background;
    a.setBackground('#282e3c');
    out.hex = hex();
    return out;
  });
  check('background accepts CSS variables and any CSS colour, exact sRGB', bg.cssVar === '336699' && bg.hsl === 'ff0000' && bg.hex === '282e3c' && bg.invalid === null && bg.undefinedVar === null, JSON.stringify(bg));
  await page.waitForTimeout(200);
  const pixel = await page.evaluate(async () => {
    const blob = await window.__a.screenshot();
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    return [...ctx.getImageData(2, 2, 1, 1).data];
  });
  check('screenshot shows the exact background colour', Math.abs(pixel[0] - 0x28) <= 2 && Math.abs(pixel[1] - 0x2e) <= 2 && Math.abs(pixel[2] - 0x3c) <= 2, pixel.join(','));
  const paint = await page.evaluate(() => window.__paint(20));
  check('live painting keeps the same GPU texture', paint.recreated === false);
  await page.locator('#view').screenshot({ path: path.join(outDir, 'preview-review-skin.png') });
  await page.close();

  // ---- block preview without WebGL ----
  page = await browser.newPage({ viewport: { width: 1000, height: 780 } });
  watch(page);
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (/webgl/.test(type)) return null;
      return orig.call(this, type, ...rest);
    };
  });
  await page.goto(`${base}/tests/harness/preview/block.html?assets=java&rotate=1`);
  await page.evaluate(() => window.__ready);
  await page.waitForTimeout(400);
  const running = await page.evaluate(() => window.__previews.map((p) => p.loop.running));
  // cells 2 (procedural water, animated cube) and 10 (flat strip with frametime) may animate; static cubes must idle
  check('no-WebGL fallback cubes do not keep a render loop running', running[0] === false && running[4] === false && running[5] === false, running.join(','));
  await page.locator('#view').screenshot({ path: path.join(outDir, 'preview-review-block-nogl.png') });
  await page.close();

  // ---- shader preview: DPR change, asset reuse, legacy textures ----
  page = await browser.newPage({ viewport: { width: 1000, height: 720 } });
  watch(page);
  await page.goto(`${base}/tests/harness/preview/shader.html?assets=legacy&preset=noon`);
  await page.evaluate(() => window.__ready);
  const w1 = await page.evaluate(() => document.querySelector('#view canvas').width);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 720, deviceScaleFactor: 2, mobile: false });
  await page.waitForTimeout(600);
  const w2 = await page.evaluate(() => ({ w: document.querySelector('#view canvas').width, dpr: devicePixelRatio }));
  check('shader preview follows a device pixel ratio change (capped at 1.5)', w1 === 960 && w2.w === 1440, `${w1} -> ${w2.w} @${w2.dpr}`);
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await page.waitForTimeout(300);
  const reuse = await page.evaluate(async () => {
    const p = window.__preview;
    const { fixtureAssets } = await import('./fixture-assets.ts');
    const a = await fixtureAssets('legacy');
    const first = p.setAssets(a);
    const second = p.setAssets(a);
    await first;
    const info = p.slotInfo;
    return { same: first === second, water: info.water.path, grey: info.water.image.data[0] === info.water.image.data[2], short: info.short_grass.path, corn: info.cornflower.path };
  });
  check('setAssets with the same index reuses the pending load', reuse.same);
  check('legacy (1.12.2) names resolve and blue water is neutralised', /blocks\/water_still/.test(reuse.water) && reuse.grey && /tallgrass/.test(reuse.short) && /blue_orchid/.test(reuse.corn), JSON.stringify(reuse));
  await page.waitForTimeout(1500);
  await page.locator('#view').screenshot({ path: path.join(outDir, 'preview-review-shader-legacy-noon.png') });
  await page.evaluate(() => window.__setAssets('bedrock'));
  const bedrock = await page.evaluate(() => window.__preview.slotInfo.short_grass.path);
  check('Bedrock tallgrass resolves to the .tga (engine priority)', bedrock === 'textures/blocks/tallgrass.tga', bedrock);
  const shadowPasses = await page.evaluate(async () => {
    const p = window.__preview;
    let passes = 0;
    const orig = p.renderer.render.bind(p.renderer);
    p.renderer.render = (scene, cam) => { if (cam === p.lightCam) passes++; orig(scene, cam); };
    // software WebGL renders only a few frames per second: snap the smoothing with screenshot(), then
    // count the passes over a few frames
    const frames = async (n) => {
      for (let i = 0; i < n; i++) await new Promise((r) => requestAnimationFrame(() => r()));
    };
    const count = async (params) => {
      p.setParams(params);
      await p.screenshot();
      await frames(2);
      passes = 0;
      await frames(6);
      return passes;
    };
    const base = { ...window.__presetValues('noon'), waving: 0.8 };
    const on = await count({ ...base, shadowStrength: 0.8 });
    const off = await count({ ...base, shadowStrength: 0 });
    p.renderer.render = orig;
    return { on, off };
  });
  check('shadow pass skipped when shadows are off', shadowPasses.on >= 2 && shadowPasses.off === 0, JSON.stringify(shadowPasses));
  const failure = await page.evaluate(async () => {
    const p = window.__preview;
    p.render = () => { throw new Error('simulated GPU failure'); };
    p.setParams({ ...window.__presetValues('noon'), exposure: 1.2 });
    for (let i = 0; i < 100 && p.loop.running; i++) await new Promise((r) => setTimeout(r, 100));
    const msg = document.querySelector('#view [role="status"]');
    return { running: p.loop.running, message: msg ? msg.textContent : null };
  });
  check('a failing renderer stops its loop and explains itself', !failure.running && /could not run/.test(failure.message || ''), JSON.stringify(failure));
  errors.splice(0, errors.length, ...errors.filter((e) => !/simulated GPU failure/.test(e)));
  await page.close();

  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close();
  process.exit(results.every(Boolean) && !errors.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
