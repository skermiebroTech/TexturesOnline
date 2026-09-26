// Drives tests/harness/data in Chromium against the live Mojang / GitHub endpoints.
// Usage: NODE_PATH=$(npm root -g) node tests/tools/data/browser-check.mjs [--port N]   (screenshots: $OUT_DIR)
// Needs network access to Mojang/GitHub; clears the harness origin's asset cache first.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const freePort = () => new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const port = (process.argv.includes('--port') && Number(process.argv[process.argv.indexOf('--port') + 1])) || (await freePort());
const outDir = process.env.OUT_DIR || resolve(tmpdir(), 'texturesonline-data-check');
mkdirSync(outDir, { recursive: true });

// Own process group so the dev server (a grandchild of npx) is stopped with it.
const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
const stopVite = () => {
  try {
    process.kill(-vite.pid, 'SIGTERM');
  } catch {
    vite.kill();
  }
};
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('vite did not start')), 30000);
  vite.stdout.on('data', (d) => { if (String(d).includes('Local')) { clearTimeout(t); res(); } });
  vite.on('exit', (c) => rej(new Error('vite exited ' + c)));
});

// Explicit flags: Playwright's `proxy` option also proxies loopback, which breaks the local dev server.
const args = process.env.HTTPS_PROXY ? [`--proxy-server=${process.env.HTTPS_PROXY}`, '--proxy-bypass-list=127.0.0.1;localhost'] : [];
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args });
const context = await browser.newContext({ acceptDownloads: true });
const requests = [];
context.on('request', (r) => {
  const u = new URL(r.url());
  if (u.hostname !== '127.0.0.1') requests.push({ host: u.hostname, path: u.pathname.slice(0, 80), range: r.headers()['range'] || null, method: r.method() });
});
const responses = [];
context.on('response', async (r) => {
  const u = new URL(r.url());
  if (u.hostname === 'piston-data.mojang.com') responses.push(`${r.status()} ${r.request().headers()['range'] || 'full'} len=${r.headers()['content-length']} fromCache=${r.fromServiceWorker ? 'sw' : ''}`);
});
const failures = [];
context.on('requestfailed', (r) => { const u = new URL(r.url()); if (u.hostname !== '127.0.0.1') failures.push(`${r.method()} ${u.hostname}${u.pathname.slice(0, 60)} ${r.failure()?.errorText}`); });

const url = `http://127.0.0.1:${port}/tests/harness/data/index.html`;
async function open() {
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('  [console]', m.type(), m.text().slice(0, 200)); });
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
  return page;
}
const run = (page, step, arg) => page.evaluate(([s, a]) => window.run(s, a), [step, arg]);
const summary = (label) => {
  const byHost = {};
  for (const r of requests) byHost[r.host] = (byHost[r.host] || 0) + 1;
  console.log(`  requests ${label}:`, JSON.stringify(byHost));
  requests.length = 0;
};

let ok = true;
const check = (cond, msg) => { console.log(`  ${cond ? 'PASS' : 'FAIL'} ${msg}`); if (!cond) ok = false; };
try {
  let page = await open();
  await run(page, 'clear');
  requests.length = 0;

  console.log('# versions');
  const v = await run(page, 'versions');
  console.log(' ', JSON.stringify({ java: v.java, javaFirst: v.javaFirst, javaSnap: v.javaSnap, oldest: v.javaOldest, default: v.default, bedrock: v.bedrock, bedrockAll: v.bedrockAll, bedrockFirst: v.bedrockFirst.map((x) => x.name), snapshotFormat: v.snapshotFormat }));
  check(v.default === '26.3' && v.javaFirst.id === '26.3' && v.javaFirst.packFormat.major === 97 && v.javaFirst.packFormat.minor === 1, 'Java default 26.3 = 97.1');
  check(v.javaOldest === '1.6.1', 'Java list reaches 1.6.1');
  check(v.bedrockDefault === 'latest' && v.bedrock > 20, 'Bedrock versions');
  check(v.snapshotFormat && v.snapshotFormat.major === 98, 'snapshot format from misode');
  check(v.preReleaseFormat && v.preReleaseFormat.major === 4, `format read from the jar's version.json (${JSON.stringify(v.preReleaseFormat)})`);
  check(v.aprilFoolsFormat && v.aprilFoolsFormat.major === 5, `April Fools build via version.json (${JSON.stringify(v.aprilFoolsFormat)})`);
  summary('versions');

  console.log('# java first load (network, range reads)');
  const j1 = await run(page, 'java', '26.3');
  console.log(' ', JSON.stringify(j1));
  const jarReqs = requests.filter((r) => r.host === 'piston-data.mojang.com');
  console.log('  jar requests:', jarReqs.map((r) => r.range).join(' | '));
  console.log('  jar responses:', responses.join(' | '));
  check(j1.textures === 3964 && j1.cachedAfter && !j1.cachedBefore, '26.3 textures loaded and cached');
  check(jarReqs.length > 0 && jarReqs.length <= 5 && jarReqs.every((r) => r.range), 'only a few Range requests to piston-data');
  check(!requests.some((r) => r.method === 'OPTIONS'), 'no CORS preflight');
  summary('java load');

  for (const [ver, count] of [['1.8.9', 1043], ['1.6.1', 862], ['26.4-snapshot-1', 3964]]) {
    const r = await run(page, 'java', ver);
    const reqs = requests.filter((x) => x.host.endsWith('mojang.com') && x.range).length;
    check(r.textures === count, `${ver}: ${r.textures} textures in ${r.ms} ms, ${reqs} range requests`);
    requests.length = 0;
  }

  console.log('# java lazy groups');
  const lz = await run(page, 'javaLazy', '26.3');
  console.log(' ', JSON.stringify(lz));
  check(lz.shaders > 50 && lz.langHasStone && lz.model.includes('cube_all'), 'shaders/lang/models fetched lazily');
  summary('lazy');

  console.log('# bedrock');
  const b = await run(page, 'bedrock', 'latest');
  console.log(' ', JSON.stringify(b));
  check(b.textures > 5000 && b.results['blocks/leaves_oak'].ext === 'tga' && b.results['blocks/grass_side'].alpha0WithColour === 211, 'bedrock textures incl. TGA with alpha data');
  const old = await run(page, 'bedrock', '1.21.120.4');
  console.log(' ', JSON.stringify({ textures: old.textures, ref: old.ref, source: old.source, stone: old.results['blocks/stone'], leaves: old.results['blocks/leaves_oak'] }));
  check(old.ref === 'v1.21.120.4' && old.textures > 1000 && old.results['blocks/stone'].size, `tagged version ${old.ref} via ${old.source}`);
  await context.route(/api\.github\.com/, (route) => route.fulfill({ status: 403, contentType: 'application/json', body: '{"message":"API rate limit exceeded"}' }));
  const atlas = await run(page, 'bedrock', '1.21.100.6');
  console.log(' ', JSON.stringify({ textures: atlas.textures, ref: atlas.ref, source: atlas.source, stone: atlas.results['blocks/stone'], leaves: atlas.results['blocks/leaves_oak'] }));
  check(atlas.source === 'atlas' && atlas.textures > 1500 && atlas.results['blocks/leaves_oak'].size, `atlas fallback when the GitHub API is unavailable (${atlas.textures} textures)`);
  await context.unroute(/api\.github\.com/);
  const tb = await run(page, 'bedrockThumbs');
  console.log(' ', JSON.stringify(tb));
  summary('bedrock');

  const fm = await run(page, 'formats');
  console.log(' ', JSON.stringify(fm));
  check(fm['image/jpeg'].size[0] === 20 && fm['image/jpeg'].left[0] > 240 && fm['image/webp'].right[2] > 240 && fm.canvas[2][0] === 255, 'browser decode of JPEG/WebP uploads + display canvas');
  console.log('# storage, zip, download');
  const st = await run(page, 'storage');
  console.log(' ', JSON.stringify(st));
  check(st.blobBytes && st.blobBytes.join() === '1,2,3' && st.afterDelete === 0, 'projects round trip with Blobs');
  const [download] = await Promise.all([page.waitForEvent('download'), run(page, 'zipAndDownload')]);
  console.log('  download:', download.suggestedFilename());
  check(download.suggestedFilename() === 'My Pack_ v1_.mcpack', 'sanitised .mcpack download');
  await page.screenshot({ path: resolve(outDir, 'harness-1.png'), fullPage: true });
  await page.close();

  console.log('# second visit (from IndexedDB)');
  page = await open();
  requests.length = 0;
  const j2 = await run(page, 'java', '26.3');
  console.log(' ', JSON.stringify({ ms: j2.ms, cachedBefore: j2.cachedBefore, textures: j2.textures }));
  check(j2.cachedBefore && !requests.some((r) => r.host.endsWith('mojang.com')), 'no Mojang requests on second visit');
  const lz2 = await run(page, 'javaLazy', '26.3');
  check(!requests.some((r) => r.host === 'piston-data.mojang.com'), `lazy groups from cache (${lz2.ms} ms)`);
  summary('second visit');
  await page.close();

  console.log('# offline');
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort('internetdisconnected'));
  page = await open();
  const j3 = await run(page, 'java', '26.3');
  check(j3.textures === 3964, `java works offline (${j3.ms} ms)`);
  const b3 = await run(page, 'bedrock', 'latest');
  check(b3.textures > 5000 && b3.results['blocks/stone'].size[0] === 16, 'bedrock textures read offline from cache');
  const vOff = await run(page, 'versions');
  check(vOff.java > 80 && vOff.bedrock > 20, 'version lists offline (cached)');
  await page.screenshot({ path: resolve(outDir, 'harness-offline.png'), fullPage: true });
  await page.close();
  await context.unroute(/^https?:\/\/(?!127\.0\.0\.1)/);
} catch (err) {
  ok = false;
  console.error('ERROR', err);
} finally {
  if (failures.length) console.log('failed requests:', failures.slice(0, 10));
  await browser.close();
  stopVite();
}
console.log(ok ? 'ALL PASS' : 'SOME CHECKS FAILED');
process.exit(ok ? 0 : 1);
