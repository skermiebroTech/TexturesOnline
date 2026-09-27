// Screenshots model harness pages. Needs TO_FIXTURES (game jars) and the global playwright package:
//   NODE_PATH=$(npm root -g) node tests/harness/models/shoot.cjs <outDir> <version> <name> <list>
const fs = require('node:fs');
const path = require('node:path');
const { startVite, launch } = require('../../e2e/textures/lib.cjs');

const [outDir, version = '26.3', name = 'models', list = 'furnace'] = process.argv.slice(2);
const fx = process.env.TO_FIXTURES;

(async () => {
  const server = await startVite();
  const browser = await launch();
  const page = await browser.newPage({ viewport: { width: 1060, height: 800 } });
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && console.log(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.route(/\/__jar\/(.+)\.jar$/, (r) => {
    const v = /\/__jar\/(.+)\.jar$/.exec(r.request().url())[1];
    const file = [path.join(fx, 'research-cache', 'jars', `${v}.jar`), path.join(fx, `client-${v}.jar`)].find((p) => fs.existsSync(p));
    return file ? r.fulfill({ status: 200, body: fs.readFileSync(file) }) : r.fulfill({ status: 404 });
  });
  await page.goto(`${server.url}tests/harness/models/models.html?v=${encodeURIComponent(version)}&list=${encodeURIComponent(list)}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  await page.waitForTimeout(1200);
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${name}.png`);
  await page.locator('#view').screenshot({ path: file });
  console.log('saved', file);
  await browser.close();
  server.stop();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
