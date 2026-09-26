// Drives the shader + block harness with mouse / wheel / keyboard and checks the camera responds.
// Usage: NODE_PATH=$(npm root -g) node tests/harness/preview/check-interaction.cjs <baseUrl>
const { chromium } = require('playwright');
const fs = require('fs');
const [base = 'http://localhost:5317'] = process.argv.slice(2);
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find((p) => fs.existsSync(p));

(async () => {
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/tests/harness/preview/shader.html?assets=none&dpr=1`);
  await page.evaluate(() => window.__ready);
  const cam = () => page.evaluate(() => { const o = window.__preview.orbit; return { az: +o.azimuth.toFixed(3), el: +o.elevation.toFixed(3), d: +o.distance.toFixed(2) }; });
  const c0 = await cam();
  const box = await page.locator('#view canvas').boundingBox();
  await page.mouse.move(box.x + 400, box.y + 300);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + 400 + i * 12, box.y + 300 + i * 4);
  await page.mouse.up();
  const c1 = await cam();
  await page.mouse.wheel(0, 400);
  const c2 = await cam();
  await page.locator('#view canvas').focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('-');
  const c3 = await cam();
  await page.keyboard.press('Home');
  const c4 = await cam();
  console.log('shader camera', JSON.stringify({ c0, c1, c2, c3, c4 }));
  const ok = c1.az < c0.az && c1.el > c0.el && c2.d > c1.d && c3.d > c2.d && c4.az === c0.az && c4.d === c0.d;
  console.log('shader interaction', ok ? 'OK' : 'FAIL');

  await page.goto(`${base}/tests/harness/preview/block.html?assets=none`);
  await page.evaluate(() => window.__ready);
  const bcam = () => page.evaluate(() => window.__previews[0].orbit.azimuth);
  const b0 = await bcam();
  const bb = await page.locator('.box canvas').first().boundingBox();
  await page.mouse.move(bb.x + 100, bb.y + 100);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(bb.x + 100 - i * 10, bb.y + 100);
  await page.mouse.up();
  const b1 = await bcam();
  console.log('block drag', b1 > b0 ? 'OK' : 'FAIL', b0.toFixed(3), b1.toFixed(3));
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
