// Shared helpers for the texture pack maker browser tests: dev server, Chromium, offline Mojang
// fixtures (routed from local files, with HTTP Range support) and zip reading.
// Needs the global `playwright` package: NODE_PATH=$(npm root -g) node tests/e2e/textures/e2e.cjs
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');

const ROOT = path.resolve(__dirname, '../../..');
const { chromium } = require('playwright');

const EXE = [process.env.CHROME, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find((p) => p && fs.existsSync(p));

/** Where the real game files live (client jar, Mojang manifests): set TO_FIXTURES. */
function fixturesDir() {
  const d = process.env.TO_FIXTURES;
  return d && fs.existsSync(path.join(d, 'client-26.3.jar')) && fs.existsSync(path.join(d, 'manifest.json')) ? d : null;
}

function freePort() {
  return new Promise((res) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => res(p));
    });
  });
}

async function startVite(port) {
  port = port || (await freePort());
  const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('vite did not start')), 30000);
    vite.stdout.on('data', (d) => {
      if (String(d).includes('Local')) {
        clearTimeout(t);
        res();
      }
    });
    vite.on('exit', (c) => rej(new Error('vite exited ' + c)));
  });
  return {
    url: `http://127.0.0.1:${port}/`,
    stop() {
      try {
        process.kill(-vite.pid, 'SIGTERM');
      } catch {
        vite.kill();
      }
    },
  };
}

async function launch() {
  // Playwright's `proxy` option would also proxy loopback, so pass the flags directly.
  const args = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'];
  if (process.env.HTTPS_PROXY) args.push(`--proxy-server=${process.env.HTTPS_PROXY}`, '--proxy-bypass-list=127.0.0.1;localhost');
  return chromium.launch({ executablePath: EXE, args });
}

/** A client jar from a local file, with Range support. */
function fulfilJar(r, jar, cors) {
  const range = r.request().headers()['range'];
  const m = range && /bytes=(\d+)-(\d+)?/.exec(range);
  if (!m) {
    return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/java-archive', 'content-length': String(jar.size) }, body: fs.readFileSync(jar.path) });
  }
  const start = Number(m[1]);
  const end = Math.min(jar.size - 1, m[2] ? Number(m[2]) : jar.size - 1);
  const buf = Buffer.alloc(end - start + 1);
  fs.readSync(jar.fd, buf, 0, buf.length, start);
  return r.fulfill({
    status: 206,
    headers: { ...cors, 'content-type': 'application/java-archive', 'content-range': `bytes ${start}-${end}/${jar.size}`, 'content-length': String(buf.length), 'accept-ranges': 'bytes' },
    body: buf,
  });
}

const openJar = (p) => ({ path: p, size: fs.statSync(p).size, fd: fs.openSync(p, 'r') });

/**
 * The newest development version whose jar the fixtures may hold, as client-<id>.jar next to the
 * 26.3 one. Its tests skip when the jar isn't there. Update the id when a newer one comes out.
 */
const NEXT_VERSION = '26.4-pre-1';

/** Path of the NEXT_VERSION jar in the fixtures, or null. */
function nextJar(fx) {
  const p = fx ? path.join(fx, `client-${NEXT_VERSION}.jar`) : null;
  return p && fs.existsSync(p) ? p : null;
}

/**
 * Serves Mojang's manifest, the 26.3 version JSON and client jar (with Range) from local files, and
 * the NEXT_VERSION jar when the fixtures have it: its version JSON is made from 26.3's with that
 * jar's sha1 and size, so the manifest's entry for the version leads to the local file.
 */
async function routeMojang(context, fx) {
  if (!fx) return;
  const manifest = fs.readFileSync(path.join(fx, 'manifest.json'));
  const v263 = fs.readFileSync(path.join(fx, 'v263.json'));
  const jar = openJar(path.join(fx, 'client-26.3.jar'));
  const cors = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range, content-length, accept-ranges' };
  const json = (body) => (r) => r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body });
  await context.route(/^https:\/\/(piston-meta|launchermeta)\.mojang\.com\/mc\/game\/version_manifest_v2\.json/, json(manifest));
  await context.route(/^https:\/\/piston-meta\.mojang\.com\/v1\/packages\/[0-9a-f]+\/26\.3\.json$/, json(v263));
  await context.route(/^https:\/\/piston-data\.mojang\.com\/v1\/objects\/e877b6a07acd633fb3bb475002175cec036e7b87\/client\.jar$/, (r) => fulfilJar(r, jar, cors));

  const nextPath = nextJar(fx);
  if (!nextPath) return;
  const next = openJar(nextPath);
  const sha1 = require('node:crypto').createHash('sha1').update(fs.readFileSync(nextPath)).digest('hex');
  const url = `https://piston-data.mojang.com/v1/objects/${sha1}/client.jar`;
  const vj = JSON.parse(v263.toString('utf8'));
  const nextJson = JSON.stringify({ ...vj, id: NEXT_VERSION, type: 'snapshot', downloads: { ...vj.downloads, client: { sha1, size: next.size, url } } });
  const id = NEXT_VERSION.replace(/\./g, '\\.');
  await context.route(new RegExp(`^https://piston-meta\\.mojang\\.com/v1/packages/[0-9a-f]+/${id}\\.json$`), json(nextJson));
  await context.route(url, (r) => fulfilJar(r, next, cors));
}

function unzip(file) {
  const { unzipSync } = require(path.join(ROOT, 'node_modules/fflate'));
  return unzipSync(new Uint8Array(fs.readFileSync(file)));
}

function decodePng(bytes) {
  // fast-png is ESM-only in recent versions; decode via a dynamic import
  return import(path.join(ROOT, 'node_modules/fast-png/lib/index.js')).then((m) => m.decode(bytes));
}

function jarEntry(fx, name) {
  const { unzipSync } = require(path.join(ROOT, 'node_modules/fflate'));
  const all = unzipSync(new Uint8Array(fs.readFileSync(path.join(fx, 'client-26.3.jar'))), { filter: (f) => f.name === name });
  return all[name];
}

module.exports = { ROOT, EXE, NEXT_VERSION, fixturesDir, nextJar, freePort, startVite, launch, routeMojang, unzip, decodePng, jarEntry };
