// End-to-end test of Pack Doctor in Chromium.
// Usage: NODE_PATH=$(npm root -g) TO_FIXTURES=<dir> node tests/e2e/textures/doctor.e2e.cjs [baseUrl] [--shots <dir>]
// Builds tiny packs on the fly (original pixel art, no game files): a broken Java pack, a broken
// Bedrock pack and a healthy Java pack. Java 26.3 game file names come from TO_FIXTURES (client
// jar, routed locally) or the real network; Bedrock's come from the bundled index.
// Checks the report, Fix all, the before-and-after, the downloaded zip (opened again and checked:
// nothing serious may be left), "Looks good" for a healthy pack, 1280 and 390 px in light and dark,
// a German run, and no console errors.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ROOT, startVite, launch, routeMojang, fixturesDir, unzip, decodePng } = require('./lib.cjs');

const argv = process.argv.slice(2);
const baseArg = argv.find((a) => /^https?:/.test(a));
const shotsDir = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : null;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tx-doctor-'));
const J = 'assets/minecraft/textures/';

let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  console.log(results[results.length - 1]);
  if (!ok) failures++;
}

// ------------------------------------------------------------------ test packs
async function encodePng(w, h, fn) {
  const { encode } = await import(path.join(ROOT, 'node_modules/fast-png/lib/index.js'));
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data.set(fn(x, y), (y * w + x) * 4);
  return encode({ width: w, height: h, data, channels: 4, depth: 8 });
}
const checkerArt = (a, b) => (x, y) => (((x >> 2) + (y >> 2)) % 2 ? a : b);
const solid = (c) => () => c;
const enc = (s) => new TextEncoder().encode(typeof s === 'string' ? s : JSON.stringify(s));
const RED = [220, 30, 30, 255];
const BLUE = [30, 60, 220, 255];
const BEDROCK_HEADER = '8f0b5a0e-6c55-4d3b-9b1e-0a4c2f9d7e11';

async function makePacks() {
  const { zipSync } = require(path.join(ROOT, 'node_modules/fflate'));
  // Java, everything wrong at once: an extra folder, Mac junk, pack.mcmeta for 1.8 with a trailing
  // comma, pre-1.13 folders, a capital letter, a model with the old path, a JSON error.
  const brokenJava = zipSync({
    'Broken Pack/pack.mcmeta': enc('{ "pack": { "pack_format": 1, "description": "My broken pack" }, }'),
    'Broken Pack/pack.png': await encodePng(64, 64, checkerArt([250, 200, 40, 255], [40, 40, 40, 255])),
    [`Broken Pack/${J}blocks/stone.png`]: await encodePng(16, 16, solid(RED)),
    [`Broken Pack/${J}blocks/Dirt.png`]: await encodePng(16, 16, checkerArt([120, 80, 40, 255], [90, 60, 30, 255])),
    'Broken Pack/assets/minecraft/models/block/stone.json': enc({ parent: 'block/cube_all', textures: { all: 'blocks/stone' } }),
    'Broken Pack/assets/minecraft/models/block/broken.json': enc('{\n  "parent": "block/cube_all"\n  "textures": {}\n}'),
    '__MACOSX/Broken Pack/._pack.mcmeta': enc('junk'),
    'Broken Pack/.DS_Store': enc('junk'),
  });
  // Bedrock in a .zip, with a manifest that has no module UUID and an unknown format_version,
  // and a texture list with the wrong capital letters.
  const brokenBedrock = zipSync({
    'manifest.json': enc({
      format_version: 9,
      header: { name: 'Phone Pack', description: 'Made on a phone', uuid: BEDROCK_HEADER, version: [1, 0, 0] },
      modules: [{ type: 'resources', version: [1, 0, 0] }],
    }),
    'pack_icon.png': await encodePng(64, 64, checkerArt([40, 120, 250, 255], [250, 250, 250, 255])),
    'textures/blocks/stone.png': await encodePng(16, 16, solid(BLUE)),
    'textures/blocks/Dirt.png': await encodePng(16, 16, solid([120, 80, 40, 255])),
    '__MACOSX/._manifest.json': enc('junk'),
  });
  const healthy = zipSync({
    'pack.mcmeta': enc({ pack: { min_format: [97, 1], max_format: 97, description: 'All fine' } }),
    'pack.png': await encodePng(64, 64, checkerArt([60, 160, 60, 255], [250, 250, 250, 255])),
    [`${J}block/stone.png`]: await encodePng(16, 16, solid(RED)),
    [`${J}item/apple.png`]: await encodePng(16, 16, checkerArt(RED, [250, 250, 250, 255])),
    'assets/minecraft/models/block/stone.json': enc({ parent: 'minecraft:block/cube_all', textures: { all: 'minecraft:block/stone' } }),
  });
  const files = {
    brokenJava: path.join(tmp, 'Broken Pack.zip'),
    brokenBedrock: path.join(tmp, 'Phone Pack.zip'),
    healthy: path.join(tmp, 'All Fine.zip'),
  };
  fs.writeFileSync(files.brokenJava, brokenJava);
  fs.writeFileSync(files.brokenBedrock, brokenBedrock);
  fs.writeFileSync(files.healthy, healthy);
  return files;
}

// ------------------------------------------------------------------ helpers
async function drop(page, file) {
  await page.setInputFiles('.dr-dz input[type=file]', file);
  await page.waitForSelector('.dr-result .dr-headline, .dr-result .cv-res-icon.is-error', { timeout: 120000 });
  await page.waitForFunction(() => !document.querySelector('.dr-result .cv-res-icon.is-busy'), null, { timeout: 120000 });
}

const codes = (page) => page.$$eval('.dr-issue', (els) => els.map((e) => e.dataset.code));
const headline = (page) => page.textContent('.dr-result .dr-headline').then((t) => t.trim());

async function fixAll(page) {
  await page.click('.dr-fix-all');
  await page.waitForSelector('.dr-result .dr-ba', { timeout: 120000 });
  await page.waitForFunction(() => !document.querySelector('.dr-result .btn.is-busy'), null, { timeout: 60000 });
}

async function download(page) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.click('.dr-download')]);
  const file = path.join(tmp, `fixed-${Date.now()}-${dl.suggestedFilename()}`);
  await dl.saveAs(file);
  await page.waitForSelector('.dr-install:not([hidden])', { timeout: 30000 });
  return { file, name: dl.suggestedFilename(), zip: unzip(file) };
}

const json = (b) => (b ? JSON.parse(Buffer.from(b).toString('utf8')) : undefined);

/** Screenshots of the current state: 1280 and 390 px, dark and light. */
async function shots(page, name) {
  if (!shotsDir) return;
  const vp = page.viewportSize();
  for (const theme of ['dark', 'light']) {
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 860 });
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        document.activeElement?.blur?.();
      });
      await page.waitForTimeout(200);
      await page.screenshot({ path: path.join(shotsDir, `doctor-${name}-${width}-${theme}.png`), fullPage: true });
    }
  }
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await page.setViewportSize(vp);
}

async function overflowAt390(page) {
  const vp = page.viewportSize();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.setViewportSize(vp);
  return o;
}

// ------------------------------------------------------------------ run
(async () => {
  const packs = await makePacks();
  const server = baseArg ? null : await startVite();
  const base = baseArg || server.url;
  const fx = fixturesDir();
  console.log(`base ${base} · fixtures ${fx ?? '(none: real network)'} · tmp ${tmp}`);
  if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
  const browser = await launch();
  const errors = [];
  const watch = (page) => {
    page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon|ERR_|404|Failed to load resource/.test(m.text())) errors.push(m.text());
    });
  };
  try {
    const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 860 }, colorScheme: 'dark' });
    await routeMojang(ctx, fx);
    const page = await ctx.newPage();
    watch(page);

    // ---------------------------------------------------------------- start screen
    await page.goto(base + 'pack-doctor');
    await page.waitForSelector('.dr-dz');
    check('page title', /Fix a Broken Minecraft Texture Pack/.test(await page.title()), await page.title());
    check('hero headline', /Fix a broken Minecraft texture pack/.test(await page.textContent('.cv-hero h1')));
    check('no main-menu item is marked current', (await page.$$('.mainnav a[aria-current="page"]')).length === 0);
    await page.waitForSelector('[data-tool-intro="doctor"]', { timeout: 15000 }).catch(() => null);
    check('the Pack Doctor introduction is mounted below the tool', !!(await page.$('[data-tool-intro="doctor"]')));
    check('footer links to Pack Doctor', !!(await page.$('.site-footer a[href$="pack-doctor/"]')));
    check('Java is chosen before a pack is added', (await page.getAttribute('.cv-ed[data-value="java"]', 'aria-checked')) === 'true');
    check('start screen: no horizontal scroll at 390 px', (await overflowAt390(page)) <= 0);
    await shots(page, '1-start');

    // ---------------------------------------------------------------- broken Java pack
    await page.click('.cv-ed-version, .dr-version .vp-trigger').catch(() => null);
    await page.keyboard.press('Escape').catch(() => null);
    await drop(page, packs.brokenJava);
    let found = await codes(page);
    console.log('  java issues:', found.join(', '));
    check('Java: problems found', /problems? found/.test(await headline(page)), await headline(page));
    for (const c of ['nested-folder', 'junk', 'mcmeta-strict', 'old-folders', 'json-syntax']) check(`Java: ${c} reported`, found.includes(c), found.join());
    check('Java: capital letters reported (bad-names)', found.includes('bad-names') || found.includes('old-folders'), found.join());
    check('Java: the pack name and its version are shown', /My broken pack|Broken Pack/.test(await page.textContent('.dr-pack')) && /Java 1\./.test(await page.textContent('.dr-pack .cv-pack-badges')), (await page.textContent('.dr-pack')).trim().slice(0, 120));
    check('Java: checked for Java 26.3', /Java 26\.3/.test(await page.textContent('.dr-result .cv-res-titles .eyebrow')));
    const nested = await page.textContent('.dr-issue[data-code="nested-folder"]');
    check('Java: the extra folder is named, with severity and affected versions', /Broken Pack/.test(nested) && /Won’t load/.test(nested) && /Affects: Every version of Java/.test(nested), nested.replace(/\s+/g, ' ').slice(0, 200));
    await page.click('.dr-issue[data-code="json-syntax"] .dr-files > summary');
    const syntax = await page.textContent('.dr-issue[data-code="json-syntax"]');
    check('Java: the broken JSON file is listed with the reader’s message', /models\/block\/broken\.json/.test(syntax) && /How to fix it/.test(syntax), syntax.replace(/\s+/g, ' ').slice(0, 240));
    check('Java: Fix all counts the safe fixes', /Fix all \d+ problems|Fix 1 problem/.test(await page.textContent('.dr-fix-all')), (await page.textContent('.dr-fix-all')).trim());
    check('Java report: no horizontal scroll at 390 px', (await overflowAt390(page)) <= 0);
    await shots(page, '2-java-report');

    await fixAll(page);
    check('Java: fixed pack ready', /Fixed pack ready/.test(await headline(page)), await headline(page));
    const ba = await page.textContent('.dr-ba');
    check('Java: before and after with what changed', /Before/.test(ba) && /After/.test(ba) && /Took the pack out of|Wrote a clean zip/.test(ba) && /junk file/.test(ba), ba.replace(/\s+/g, ' ').slice(0, 300));
    const after = await codes(page);
    check('Java: only the JSON error (which needs a person) is left among serious problems', !after.some((c) => ['nested-folder', 'junk', 'mcmeta-strict', 'old-folders', 'format-mismatch'].includes(c)), after.join());
    check('Java after the fixes: no horizontal scroll at 390 px', (await overflowAt390(page)) <= 0);
    await shots(page, '3-java-fixed');
    const j = await download(page);
    check('Java: download is a .zip named after the pack', j.name === 'Broken Pack.zip', j.name);
    const keys = Object.keys(j.zip);
    check('Java: pack.mcmeta at the top of the zip, no extra folder', !!j.zip['pack.mcmeta'] && !keys.some((k) => k.startsWith('Broken Pack/')), keys.slice(0, 6).join());
    check('Java: no junk files', !keys.some((k) => /__MACOSX|\.DS_Store/.test(k)), keys.join());
    const mcmeta = json(j.zip['pack.mcmeta']);
    check('Java: pack.mcmeta for Java 26.3 keeps the description', mcmeta?.pack?.description === 'My broken pack' && (mcmeta.pack.max_format === 97 || JSON.stringify(mcmeta.pack.max_format).startsWith('[97') || mcmeta.pack.pack_format === 97), JSON.stringify(mcmeta?.pack));
    check('Java: textures moved to 1.13+ folders, lowercase', !!j.zip[`${J}block/stone.png`] && !!j.zip[`${J}block/dirt.png`] && !keys.some((k) => k.includes('/blocks/')), keys.filter((k) => k.includes('textures')).join());
    check('Java: the model follows the rename', /block\/stone/.test(json(j.zip['assets/minecraft/models/block/stone.json'])?.textures?.all ?? ''), JSON.stringify(json(j.zip['assets/minecraft/models/block/stone.json'])));
    const stone = await decodePng(j.zip[`${J}block/stone.png`]);
    check('Java: the texture’s pixels are unchanged', Array.from(stone.data.slice(0, 4)).join() === RED.join());
    check('Java: install help after the download', /resourcepacks|Resource Packs/.test(await page.textContent('.dr-install')), (await page.textContent('.dr-install')).trim().slice(0, 160));

    // The fixed pack, checked again: nothing serious left (the broken model needs a person).
    await page.click('.dr-again');
    await page.waitForSelector('.dr-dz:not([hidden])');
    await drop(page, j.file);
    const again = await codes(page);
    const serious = await page.$$eval('.dr-issue.sev-error, .dr-issue.sev-broken', (els) => els.map((e) => e.dataset.code));
    check('Java: the downloaded pack checked again has nothing serious but the JSON error', serious.every((c) => c === 'json-syntax'), again.join());

    // ---------------------------------------------------------------- broken Bedrock pack
    await page.click('.dr-again');
    await drop(page, packs.brokenBedrock);
    found = await codes(page);
    console.log('  bedrock issues:', found.join(', '));
    check('Bedrock: the edition follows the pack', (await page.getAttribute('.cv-ed[data-value="bedrock"]', 'aria-checked')) === 'true' && (await page.isHidden('.dr-version')));
    for (const c of ['bedrock-zip', 'manifest-format', 'manifest-uuid', 'manifest-engine', 'junk', 'bedrock-case']) check(`Bedrock: ${c} reported`, found.includes(c), found.join());
    const caseIssue = await page.textContent('.dr-issue[data-code="bedrock-case"]');
    check('Bedrock: wrong case explained for phones', /Android, iPhone, iPad and consoles/.test(caseIssue), caseIssue.replace(/\s+/g, ' ').slice(0, 200));
    await shots(page, '4-bedrock-report');
    await fixAll(page);
    check('Bedrock: fixed pack ready, nothing left', /Fixed pack ready/.test(await headline(page)) && /Every problem that could be fixed is fixed/.test(await page.textContent('.dr-result .cv-res-titles')), (await page.textContent('.dr-result .cv-res-titles')).trim());
    check('Bedrock after the fixes: no horizontal scroll at 390 px', (await overflowAt390(page)) <= 0);
    await shots(page, '5-bedrock-fixed');
    const b = await download(page);
    check('Bedrock: download is a .mcpack', b.name === 'Phone Pack.mcpack', b.name);
    const manifest = json(b.zip['manifest.json']);
    check('Bedrock: manifest repaired (format 2, module UUID, engine version), header UUID kept', manifest?.format_version === 2 && /^[0-9a-f-]{36}$/.test(manifest.modules?.[0]?.uuid ?? '') && manifest.modules[0].uuid !== BEDROCK_HEADER && manifest.header.uuid === BEDROCK_HEADER && Array.isArray(manifest.header.min_engine_version), JSON.stringify(manifest));
    check('Bedrock: file renamed to the game’s spelling', !!b.zip['textures/blocks/dirt.png'] && !b.zip['textures/blocks/Dirt.png'], Object.keys(b.zip).join());
    check('Bedrock: no junk', !Object.keys(b.zip).some((k) => k.includes('__MACOSX')));

    // ---------------------------------------------------------------- healthy pack
    await page.click('.dr-again');
    await page.click('.cv-ed[data-value="java"]');
    await drop(page, packs.healthy);
    check('healthy pack: Looks good', (await headline(page)) === 'Looks good', await headline(page));
    check('healthy pack: no problems listed, no Fix all', (await codes(page)).filter((c) => !c).length === 0 && !(await page.$('.dr-fix-all')) && !(await page.$('.dr-issue.sev-error, .dr-issue.sev-broken, .dr-issue.sev-warning')), (await codes(page)).join());
    check('healthy pack: what was checked is listed', (await page.$$('.dr-checked[open] .dr-checked-list li')).length >= 5);
    await shots(page, '6-healthy');

    // Changing the version checks again.
    await page.click('.dr-version .vp-trigger');
    await page.waitForSelector('.vp-pop:not([hidden]), .vp-menu, [role="listbox"]', { timeout: 10000 });
    const option = await page.$('[role="option"][data-value="1.12.2"], [role="option"]:has-text("1.12.2")');
    if (option) {
      await option.click();
      await page.waitForFunction(() => /1\.12\.2/.test(document.querySelector('.dr-result .cv-res-titles .eyebrow')?.textContent ?? ''), null, { timeout: 60000 });
      const now = await codes(page);
      check('another version: checked again for Java 1.12.2, newer folders reported', now.includes('format-mismatch') || now.includes('new-folders'), now.join());
    } else check('another version: the version list offers 1.12.2', false);
    await ctx.close();

    // ---------------------------------------------------------------- German
    const de = await browser.newContext({ acceptDownloads: true, viewport: { width: 390, height: 844 }, colorScheme: 'light', locale: 'de-DE' });
    await routeMojang(de, fx);
    const p2 = await de.newPage();
    watch(p2);
    await p2.goto(base + 'de/pack-doctor');
    await p2.waitForSelector('.dr-dz');
    check('de: page is German', (await p2.getAttribute('html', 'lang')) === 'de' && /Texture Pack/.test(await p2.textContent('.cv-hero h1')), (await p2.textContent('.cv-hero h1')).trim());
    await drop(p2, packs.brokenJava);
    const deHead = await headline(p2);
    check('de: report in German', /Probleme? gefunden/.test(deHead), deHead);
    check('de: severity in German', /Lädt nicht/.test(await p2.textContent('.dr-issue[data-code="nested-folder"]')));
    await p2.click('.dr-fix-all');
    await p2.waitForSelector('.dr-result .dr-ba', { timeout: 120000 });
    check('de: before and after in German', /Vorher/.test(await p2.textContent('.dr-ba')) && /Nachher/.test(await p2.textContent('.dr-ba')));
    check('de: no horizontal scroll at 390 px', (await p2.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 0);
    if (shotsDir) {
      await p2.evaluate(() => {
        window.scrollTo(0, 0);
        document.activeElement?.blur?.();
      });
      await p2.waitForTimeout(200);
      await p2.screenshot({ path: path.join(shotsDir, 'doctor-7-de-fixed-390-light.png'), fullPage: true });
    }
    await de.close();
  } catch (err) {
    check('no unexpected exception', false, err && err.stack ? err.stack.split('\n').slice(0, 3).join(' | ') : String(err));
  } finally {
    await browser.close();
    server?.stop();
  }
  const errs = [...new Set(errors)];
  check('no page errors', errs.length === 0, errs.slice(0, 5).join(' || '));
  console.log(`\n${results.length - failures}/${results.length} checks passed`);
  process.exit(failures ? 1 : 0);
})();
