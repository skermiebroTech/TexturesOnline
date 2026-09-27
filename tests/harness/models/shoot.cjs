// Screenshots model harness pages. Needs TO_FIXTURES (game jars) and the global playwright package:
//   NODE_PATH=$(npm root -g) node tests/harness/models/shoot.cjs <outDir> <version> <name> <list> [extra query, e.g. size=320&cols=3]
// <version> is a Java version with a jar in the fixtures, or 'bedrock' (vanilla pack from the network,
// shapes from the 26.3 jar's models).
const fs = require('node:fs');
const path = require('node:path');
const { startVite, launch } = require('../../e2e/textures/lib.cjs');

const [outDir, version = '26.3', name = 'models', list = 'furnace', extra = ''] = process.argv.slice(2);
const fx = process.env.TO_FIXTURES;

(async () => {
  const server = await startVite();
  const browser = await launch();
  // Every cell must be on screen: the 3D views only draw while visible.
  const q = new URLSearchParams(extra);
  const size = Number(q.get('size') ?? 240);
  const cols = Number(q.get('cols') ?? 4);
  const rows = Math.ceil(list.split(',').filter(Boolean).length / cols);
  const page = await browser.newPage({ viewport: { width: Math.max(1060, cols * (size + 12) + 40), height: Math.max(800, rows * (size + 40) + 40) } });
  page.on('console', (m) => m.type() === 'error' && console.log(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.route(/\/__jar\/(.+)\.jar$/, (r) => {
    const v = /\/__jar\/(.+)\.jar$/.exec(r.request().url())[1];
    const file = [path.join(fx, 'research-cache', 'jars', `${v}.jar`), path.join(fx, `client-${v}.jar`)].find((p) => fs.existsSync(p));
    return file ? r.fulfill({ status: 200, body: fs.readFileSync(file) }) : r.fulfill({ status: 404 });
  });
  await page.goto(`${server.url}tests/harness/models/models.html?v=${encodeURIComponent(version)}&list=${encodeURIComponent(list)}${extra ? `&${extra}` : ''}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 300000 });
  await page.waitForTimeout(1200);
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${name}.png`);
  await page.locator('#view').screenshot({ path: file });
  const labels = await page.$$eval('#view .cell p', (ps) => ps.map((p) => p.title || p.textContent));
  fs.writeFileSync(path.join(outDir, `${name}.txt`), labels.join('\n') + '\n');
  console.log('saved', file);
  await browser.close();
  server.stop();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
