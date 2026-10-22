// End-to-end test of the sound editor in Chromium: the Sounds list (search, categories, play), a
// vanilla Java sound played straight from Mojang's server (served here without CORS headers, like
// the real one), replacing a sound with an uploaded WAV, trimming it on the waveform, the volume,
// exporting and checking the .ogg in the zip is valid Ogg Vorbis that decodes back, saving across a
// reload, recording with a (fake) microphone, a blocked microphone, reset, phone layout, and a
// Bedrock pack (FSB5 vanilla sound, sound_definitions.json in the .mcpack).
// The game's sound list and sounds are tiny generated stand-ins (no Mojang files): the asset index,
// sounds.json (misode's mirror) and the sound files are routed. Java textures come from TO_FIXTURES
// (client jar) or the network; Bedrock textures from GitHub (network needed, skip with --no-bedrock).
// Usage: NODE_PATH=$(npm root -g) TO_FIXTURES=<dir> node tests/e2e/textures/sounds.e2e.cjs [baseUrl] [--no-bedrock] [--shots <dir>]
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { ROOT, EXE, startVite, routeMojang, fixturesDir, unzip } = require('./lib.cjs');
const { chromium } = require('playwright');

const argv = process.argv.slice(2);
const baseArg = argv.find((a) => /^https?:/.test(a));
const doBedrock = !argv.includes('--no-bedrock');
const shotsDir = argv.includes('--shots') ? argv[argv.indexOf('--shots') + 1] : null;
if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tx-sounds-'));

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}

// ------------------------------------------------------------------ generated audio
function tone(n, rate, hz, amp, from = 0, to = n) {
  const a = new Float32Array(n);
  for (let i = from; i < to; i++) a[i] = amp * Math.sin((2 * Math.PI * hz * i) / rate);
  return a;
}

function wav(channels, rate) {
  const n = channels[0].length;
  const ch = channels.length;
  const buf = Buffer.alloc(44 + n * ch * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * ch * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(ch, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * ch * 2, 28);
  buf.writeUInt16LE(ch * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * ch * 2, 40);
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++, o += 2) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, channels[c][i])) * 32767), o);
  return buf;
}

async function vorbis(channels, rate) {
  const { createEncoder } = require(path.join(ROOT, 'node_modules/wasm-media-encoders/dist/index.cjs'));
  const enc = await createEncoder('audio/ogg', fs.readFileSync(path.join(ROOT, 'node_modules/wasm-media-encoders/wasm/ogg.wasm')));
  enc.configure({ channels: channels.length, sampleRate: rate, vbrQuality: 3 });
  const parts = [Buffer.from(enc.encode(channels)), Buffer.from(enc.finalize())];
  return Buffer.concat(parts);
}

/** A one-sound FSB5 bank with 16-bit PCM (Bedrock's vanilla sounds are FSB5; FADPCM is unit-tested). */
function fsb5Pcm(samples, rate) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(v * 32767), i * 2));
  const head = Buffer.alloc(0x3c + 16);
  head.write('FSB5', 0);
  head.writeUInt32LE(1, 4);
  head.writeUInt32LE(1, 8);
  head.writeUInt32LE(16, 12);
  head.writeUInt32LE(0, 16);
  head.writeUInt32LE(data.length, 20);
  head.writeUInt32LE(2, 24);
  head.writeUInt32LE(1 | (8 << 1), 0x3c); // extra chunk follows, 44.1 kHz index, mono
  head.writeUInt32LE((samples.length << 2) >>> 0, 0x40);
  head.writeUInt32LE(((4 << 1) | (2 << 25)) >>> 0, 0x44); // frequency chunk
  head.writeUInt32LE(rate, 0x48);
  return Buffer.concat([head, data]);
}

// ------------------------------------------------------------------ Ogg checks (independent of the app's code)
const CRC = new Uint32Array(256).map((_, i) => {
  let r = i << 24;
  for (let j = 0; j < 8; j++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1;
  return r >>> 0;
});
function oggInfo(b) {
  let pos = 0;
  let pages = 0;
  let crcOk = true;
  let granule = 0;
  let eos = false;
  let first = null;
  while (pos + 27 <= b.length) {
    if (b.toString('latin1', pos, pos + 4) !== 'OggS') return { ok: false, why: `no OggS at ${pos}` };
    const nseg = b[pos + 26];
    let len = 0;
    for (let i = 0; i < nseg; i++) len += b[pos + 27 + i];
    const end = pos + 27 + nseg + len;
    const page = Buffer.from(b.subarray(pos, end));
    const crc = page.readUInt32LE(22);
    page.writeUInt32LE(0, 22);
    let c = 0;
    for (const x of page) c = ((c << 8) ^ CRC[((c >>> 24) & 0xff) ^ x]) >>> 0;
    if (c !== crc) crcOk = false;
    granule = Number(b.readBigInt64LE(pos + 6));
    eos = (b[pos + 5] & 4) !== 0;
    if (!first) first = b.subarray(pos + 27 + nseg, pos + 27 + nseg + b[pos + 27]);
    pages++;
    pos = end;
  }
  const vorbis = !!first && first[0] === 1 && first.toString('latin1', 1, 7) === 'vorbis';
  return { ok: vorbis && crcOk && eos && pos === b.length, vorbis, crcOk, eos, pages, granule, channels: first?.[11], rate: first?.readUInt32LE(12) };
}

// ------------------------------------------------------------------ routes: the game's sounds
const J = 'assets/minecraft/sounds/';
const SOUNDS_JSON = {
  'ambient.cave': { sounds: ['ambient/cave/cave1', 'ambient/cave/cave2'] },
  'block.stone.break': { sounds: ['block/stone/break1', { name: 'block/stone/break2', volume: 0.9 }], subtitle: 'subtitles.block.generic.break' },
  'block.stone.step': { sounds: ['block/stone/break1'] },
  'entity.creeper.primed': { sounds: ['random/fuse'] },
  'item.armor.equip_iron': { sounds: ['item/armor/equip_iron1'] },
  'music.game': { sounds: [{ name: 'music/game/calm1', stream: true }] },
  'music_disc.cat': { sounds: [{ name: 'records/cat', stream: true }] },
  'ui.button.click': { sounds: ['random/click'] },
  'weather.rain': { sounds: ['ambient/weather/rain1'] },
};
const FILES = [...new Set(Object.values(SOUNDS_JSON).flatMap((e) => e.sounds.map((s) => (typeof s === 'string' ? s : s.name))))];
const hashOf = (s) => crypto.createHash('sha1').update(s).digest('hex');
const INDEX = { objects: { 'minecraft/sounds.json': { hash: hashOf('sounds.json'), size: 1 }, 'minecraft/lang/de_de.json': { hash: hashOf('de'), size: 1 } } };
for (const f of FILES) INDEX.objects[`minecraft/sounds/${f}.ogg`] = { hash: hashOf(f), size: 1 };

const BEDROCK_DEFS = {
  format_version: '1.20.20',
  sound_definitions: {
    'random.click': { category: 'ui', sounds: ['sounds/random/click'] },
    'dig.stone': { category: 'block', sounds: ['sounds/dig/stone1', 'sounds/dig/stone2'] },
    'mob.creeper.say': { category: 'hostile', sounds: ['sounds/mob/creeper/say1'] },
  },
};

async function routeSounds(ctx, hits) {
  const java = await vorbis([tone(11025, 44100, 660, 0.4)], 44100);
  const fsb = fsb5Pcm(tone(8000, 32000, 500, 0.5), 32000);
  const cors = { 'access-control-allow-origin': '*' };
  await ctx.route(/^https:\/\/piston-meta\.mojang\.com\/v1\/packages\/[0-9a-f]+\/\d+\.json$/, (r) => {
    hits.index++;
    r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(INDEX) });
  });
  await ctx.route(/^https:\/\/(raw\.githubusercontent\.com\/misode\/mcmeta\/|cdn\.jsdelivr\.net\/gh\/misode\/mcmeta@)[^/]+-assets\/assets\/minecraft\/sounds\.json$/, (r) => {
    hits.soundsJson++;
    r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(SOUNDS_JSON) });
  });
  // Mojang's sound server sends no CORS headers: only <audio> can use it.
  await ctx.route(/^https:\/\/resources\.download\.minecraft\.net\/[0-9a-f]{2}\/[0-9a-f]{40}$/, (r) => {
    hits.mojang++;
    r.fulfill({ status: 200, headers: { 'content-type': 'application/octet-stream' }, body: java });
  });
  await ctx.route(/bedrock-samples[@/][^/]+\/resource_pack\/sounds\/sound_definitions\.json$/, (r) => {
    hits.defs++;
    r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(BEDROCK_DEFS) });
  });
  await ctx.route(/bedrock-samples[@/][^/]+\/resource_pack\/sounds\/.+\.(fsb|ogg|wav)$/, (r) => {
    if (/random\/click\.fsb$/.test(r.request().url())) {
      hits.fsb++;
      return r.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/octet-stream' }, body: fsb });
    }
    r.fulfill({ status: 404, headers: cors, body: '404: Not Found' });
  });
}

// ------------------------------------------------------------------ helpers
async function launch() {
  const args = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'];
  if (process.env.HTTPS_PROXY) args.push(`--proxy-server=${process.env.HTTPS_PROXY}`, '--proxy-bypass-list=127.0.0.1;localhost');
  return chromium.launch({ executablePath: EXE, args });
}

async function newPack(page, base, name, bedrock = false) {
  await page.goto(base + 'textures');
  await page.waitForSelector('.tx-new');
  if (bedrock) {
    await page.click('.tx-new .segmented-item[data-value="bedrock"]');
    await page.waitForFunction(() => /Bedrock/.test(document.querySelector('.tx-new .vp-trigger')?.textContent ?? ''));
  }
  await page.fill('.tx-name-field input', name);
  await page.click('.tx-create-btn');
  await page.waitForURL(/(#\/|\/)textures\/[0-9a-f-]+\/?$/, { timeout: 15000 });
  await page.waitForFunction(() => !!window.__tx && document.querySelector('.tx-main'), null, { timeout: 180000 });
}

async function openSounds(page) {
  await page.locator('.tx-libbar .segmented-item[data-value="sounds"]:visible').first().click();
  await page.waitForFunction(() => document.querySelectorAll('.snd-row').length > 0, null, { timeout: 60000 });
}

const state = (page, fn, arg) => page.evaluate(async ([f, a]) => new Function('s', 'a', `return (${f})(s, a)`)(await window.__tx.sounds().then((m) => m.state), a), [fn.toString(), arg]);

async function pick(page, query, id) {
  const input = page.locator('.snd-browser .tx-search-input:visible');
  await input.fill(query);
  await page.waitForFunction((i) => document.querySelector('.snd-row .tx-tile-id')?.textContent === i, id, { timeout: 10000 });
  await page.locator('.snd-row').first().click();
  await page.waitForFunction((i) => document.querySelector('.snd-panel .tx-head-sub')?.textContent.startsWith(i), id, { timeout: 10000 });
}

async function upload(page, cardIndex, file) {
  const card = page.locator('.snd-var').nth(cardIndex);
  await card.locator('.snd-var-replace').click();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('.menu [role="menuitem"]:has-text("Upload")').click()]);
  await chooser.setFiles(file);
}

const settled = (page, stem) =>
  page.waitForFunction(
    (s) => {
      const st = window.__tx.soundState();
      return st.stems.has(s) && !st.busyStems.has(s) && document.querySelector(`.snd-var[data-stem="${s}"] .snd-wave`);
    },
    stem,
    { timeout: 30000 },
  );

async function exportPack(page, ext) {
  await page.click('.tx-export-btn');
  await page.waitForSelector('.tx-export-modal .tx-exp-rows');
  const rows = await page.evaluate(() => document.querySelector('.tx-export-modal .tx-exp-rows')?.textContent ?? '');
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 180000 }), page.click(`.tx-export-modal .btn-primary:has-text("Export ${ext}")`)]);
  const file = path.join(tmp, download.suggestedFilename());
  await download.saveAs(file);
  await page.click('.tx-export-modal .btn-primary:has-text("Done")');
  return { file, rows };
}

/** Decodes an Ogg file with the browser's own decoder. */
const decodeInPage = (page, buf) =>
  page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const audio = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(bytes.buffer);
    let peak = 0;
    const d = audio.getChannelData(0);
    for (const v of d) peak = Math.max(peak, Math.abs(v));
    return { duration: audio.duration, channels: audio.numberOfChannels, peak };
  }, buf.toString('base64'));

async function shots(page, name) {
  if (!shotsDir) return;
  const vp = page.viewportSize();
  for (const theme of ['dark', 'light']) {
    await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 860 });
      await page.evaluate(() => document.activeElement?.blur?.());
      await page.waitForTimeout(350);
      await page.screenshot({ path: path.join(shotsDir, `sounds-${name}-${width}-${theme}.png`) });
    }
  }
  await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
  await page.setViewportSize(vp);
  await page.waitForTimeout(200);
}

// ------------------------------------------------------------------ run
(async () => {
  const server = baseArg ? null : await startVite();
  const base = baseArg || server.url;
  const fx = fixturesDir();
  console.log(`base ${base} · fixtures ${fx ?? '(none: real network)'}`);
  const browser = await launch();
  const errors = [];
  const watch = (page) => {
    page.on('pageerror', (e) => errors.push(`pageerror ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' && !/favicon|ERR_|404|Failed to load resource/.test(m.text())) errors.push(m.text());
    });
  };
  const hits = { index: 0, soundsJson: 0, mojang: 0, defs: 0, fsb: 0 };
  try {
    const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 860 }, colorScheme: 'dark' });
    await routeMojang(ctx, fx);
    await routeSounds(ctx, hits);
    const page = await ctx.newPage();
    watch(page);
    await newPack(page, base, 'E2E Sounds');

    // ---- the switch and the list
    const sw = await page.evaluate(() => {
      const bar = [...document.querySelectorAll('.tx-libbar')].find((b) => b.offsetParent);
      const items = [...bar.querySelectorAll('.segmented-item')];
      return { labels: items.map((b) => b.getAttribute('aria-label') || b.textContent.trim()), fits: items.every((b) => b.scrollWidth <= b.clientWidth + 1), width: bar.clientWidth };
    });
    check('the library switch has GUI and Sounds after All, and every label fits', sw.labels.join('|') === 'Blocks|Items|Mobs|All textures|GUI and menus|Sounds' && sw.fits, `${sw.labels.join(', ')} in ${sw.width}px`);
    await openSounds(page);
    const rows = await page.evaluate(() => document.querySelectorAll('.snd-row').length);
    check('Sounds lists the game’s sound events', rows === Object.keys(SOUNDS_JSON).length, `${rows} rows`);
    check('the sound list comes from the asset index and sounds.json', hits.index >= 1 && hits.soundsJson >= 1, JSON.stringify(hits));
    const centre = await page.evaluate(() => ({ canvas: !!document.querySelector('.tx-col-center > .tx-center:not(.snd-panel)')?.offsetParent, panel: !!document.querySelector('.snd-panel')?.offsetParent }));
    check('the centre shows the sound editor instead of the pixel editor', !centre.canvas && centre.panel, JSON.stringify(centre));

    // categories
    await page.click('.snd-browser .tx-catpick');
    const cats = await page.evaluate(() => [...document.querySelectorAll('.tx-catmenu-item')].map((b) => b.dataset.cat));
    check('sounds are grouped in categories', ['all', 'ambient', 'block', 'entity', 'item', 'music', 'records', 'ui', 'weather'].every((c) => cats.includes(c)), cats.join(','));
    await page.click('.tx-catmenu-item[data-cat="records"]');
    const recs = await page.evaluate(() => [...document.querySelectorAll('.snd-row .tx-tile-id')].map((e) => e.textContent));
    check('a category shows only its sounds', recs.join() === 'music_disc.cat', recs.join());
    await page.click('.snd-browser .tx-catpick');
    await page.click('.tx-catmenu-item[data-cat="all"]');

    // search + keyboard play of a vanilla sound (straight from Mojang, no CORS)
    await page.locator('.snd-browser .tx-search-input:visible').fill('fuse');
    await page.waitForFunction(() => document.querySelector('.snd-row .tx-tile-id')?.textContent === 'entity.creeper.primed', null, { timeout: 10000 });
    check('searching finds an event by its file name', true);
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => document.activeElement?.classList.contains('snd-list'));
    await page.keyboard.press('Enter');
    await page.keyboard.press(' ');
    await page.waitForFunction(() => !!window.__tx.soundState()?.player.key, null, { timeout: 10000 }).catch(() => undefined);
    const played = await state(page, (s) => s.player.key);
    check('Space in the list plays the sound', played === 'event:entity.creeper.primed', String(played));
    await page.waitForTimeout(400);
    check('the game’s Java sound is played from Mojang’s server', hits.mojang >= 1, `${hits.mojang} requests`);
    await shots(page, '1-list');

    // ---- replace with an uploaded WAV (stereo, 48 kHz: resampled, mixed to mono for a block sound)
    await pick(page, 'stone break', 'block.stone.break');
    const cards = await page.evaluate(() => [...document.querySelectorAll('.snd-var .snd-var-path')].map((e) => e.textContent));
    check('an event shows its files', cards.join() === 'block/stone/break1,block/stone/break2', cards.join());
    const users = await page.evaluate(() => [...document.querySelectorAll('.snd-var')[0].querySelectorAll('.snd-user-chip')].map((e) => e.textContent));
    check('a shared file says where else it’s heard', users.join() === 'Stone Step', users.join());
    const wavFile = path.join(tmp, 'boom.wav');
    const R = 48000;
    fs.writeFileSync(wavFile, wav([tone(R, R, 440, 0.6, R / 4, (3 * R) / 4), tone(R, R, 440, 0.6, R / 4, (3 * R) / 4)], R));
    const stem = `${J}block/stone/break1`;
    await upload(page, 0, wavFile);
    await settled(page, stem);
    const ed = await state(page, (s, st) => {
      const f = s.fileOf({ stem: st });
      const e = s.editOf({ stem: st });
      return { path: f?.path, type: f?.blob.type, size: f?.blob.size, start: e?.start, end: e?.end, gain: e?.gain, stereo: e?.stereo, source: !!e?.source, name: e?.sourceName };
    }, stem);
    check('the upload replaces the file as Ogg', ed.path === `${stem}.ogg` && ed.type === 'audio/ogg' && ed.size > 500, JSON.stringify(ed));
    check('an upload keeps its length and volume, mono for a block sound', ed.start === 0 && Math.abs(ed.end - 1) < 0.01 && ed.gain === 1 && ed.stereo === false && ed.source && ed.name === 'boom.wav', JSON.stringify(ed));
    await page.waitForFunction(() => document.querySelector('.snd-browser .tx-edited-chip .tx-chip-count')?.textContent !== '0', null, { timeout: 5000 }).catch(() => undefined);
    const marks = await page.evaluate(() => ({
      card: document.querySelector('.snd-var')?.classList.contains('is-edited'),
      row: document.querySelector('.snd-row[aria-selected="true"]')?.classList.contains('is-edited'),
      chip: document.querySelector('.snd-browser .tx-edited-chip .tx-chip-count')?.textContent,
      head: document.querySelector('.snd-panel .tx-head-badges')?.textContent,
      second: document.querySelectorAll('.snd-var')[1]?.classList.contains('is-edited'),
    }));
    check('replaced sounds are marked like edited textures (both events of the shared file)', marks.card && marks.row && marks.chip === '2' && /Replaced/.test(marks.head) && !marks.second, JSON.stringify(marks));

    // trim on the waveform (keyboard on the end handle) and normalise
    await page.locator('.snd-var').first().locator('.snd-wave-handle.is-end').focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowLeft');
    await page.locator('.snd-var').first().locator('.snd-wave-handle.is-start').focus();
    for (let i = 0; i < 2; i++) await page.keyboard.press('Shift+ArrowRight');
    await page.waitForFunction(
      (s) => {
        const st = window.__tx.soundState();
        const e = st.editOf({ stem: s });
        return e && Math.abs(e.end - 0.7) < 0.005 && Math.abs(e.start - 0.2) < 0.005 && !st.busyStems.has(s);
      },
      stem,
      { timeout: 15000 },
    );
    check('the trim handles move with the keyboard and are saved', true);
    const aria = await page.evaluate(() => document.querySelector('.snd-wave-handle.is-end')?.getAttribute('aria-valuetext'));
    check('trim handles are labelled sliders', aria === '0.70 seconds', aria);
    await page.locator('.snd-var').first().locator('button:has-text("Normalise")').click();
    await page.waitForFunction(
      (s) => {
        const st = window.__tx.soundState();
        const e = st.editOf({ stem: s });
        return e && e.gain > 1.4 && !st.busyStems.has(s);
      },
      stem,
      { timeout: 15000 },
    );
    const gain = await state(page, (s, st) => s.editOf({ stem: st }).gain, stem);
    check('Normalise raises a quiet sound to full level', gain > 1.5 && gain < 1.6, String(gain));
    // play the edited version
    await page.locator('.snd-var').first().locator('.snd-var-play').click();
    const playing = await state(page, (s) => s.player.key);
    check('the replaced sound plays', playing === `pack:${stem}`, String(playing));
    await page.waitForTimeout(200);
    await shots(page, '2-edited');

    // ---- export
    const { file, rows: expRows } = await exportPack(page, '.zip');
    check('the export summary counts replaced sounds', /Replaced sounds\s*1/.test(expRows), expRows.replace(/\s+/g, ' ').slice(0, 120));
    const zip = unzip(file);
    const ogg = zip[`${stem}.ogg`] && Buffer.from(zip[`${stem}.ogg`]);
    check('the .ogg is in the zip at assets/minecraft/sounds/...', !!ogg, Object.keys(zip).filter((k) => k.includes('sounds')).join(', '));
    if (ogg) {
      const info = oggInfo(ogg);
      check('it is valid Ogg Vorbis (page CRCs, Vorbis header, end of stream)', info.ok, JSON.stringify(info));
      check('mono, 44.1 kHz, trimmed to 0.5 s', info.channels === 1 && info.rate === 44100 && Math.abs(info.granule - 0.5 * 44100) <= 2, JSON.stringify(info));
      const dec = await decodeInPage(page, ogg);
      check('it decodes back in the browser', Math.abs(dec.duration - 0.5) < 0.01 && dec.peak > 0.85 && dec.peak <= 1.0, JSON.stringify(dec));
    }
    check('no sounds.json is needed to replace files', !zip['assets/minecraft/sounds.json']);
    check('the other file of the event is not exported', !zip[`${J}block/stone/break2.ogg`]);

    // ---- saved across a reload; Sounds mode is remembered
    await page.reload();
    await page.waitForFunction(() => !!window.__tx && document.querySelectorAll('.snd-row').length > 0, null, { timeout: 120000 });
    const after = await state(page, (s, st) => ({ edited: s.stems.has(st), count: s.editedEventCount() }), stem);
    check('replaced sounds are saved with the project', after.edited && after.count === 2, JSON.stringify(after));

    // ---- record with the (fake) microphone, and a blocked microphone
    await pick(page, 'click', 'ui.button.click');
    const clickStem = `${J}random/click`;
    await page.locator('.snd-var-replace').first().click();
    await page.locator('.menu [role="menuitem"]:has-text("Record")').click();
    await page.waitForSelector('.snd-rec-modal .snd-rec-start');
    await shots(page, '3-recorder');
    await page.click('.snd-rec-modal .snd-rec-start');
    await page.waitForSelector('.snd-rec.is-recording', { timeout: 10000 });
    await page.waitForTimeout(1500);
    await page.click('.snd-rec-modal .snd-rec-stop');
    await settled(page, clickStem);
    const rec = await state(page, (s, st) => ({ name: s.editOf({ stem: st })?.sourceName, end: s.editOf({ stem: st })?.end }), clickStem);
    check('a microphone recording replaces the sound', rec.name === 'Recording' && rec.end > 0.3, JSON.stringify(rec));
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
    });
    await page.locator('.snd-var-replace').first().click();
    await page.locator('.menu [role="menuitem"]:has-text("Record")').click();
    await page.click('.snd-rec-modal .snd-rec-start');
    await page.waitForSelector('.snd-rec-status.is-error');
    const denied = await page.evaluate(() => ({ text: document.querySelector('.snd-rec-status')?.textContent, retry: document.querySelector('.snd-rec-start')?.textContent }));
    check('a blocked microphone explains how to allow it', /blocked/.test(denied.text) && /Try again/.test(denied.retry), denied.text);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('dialog[open]'));

    // ---- reset
    await page.locator('.snd-var').first().locator('.snd-var-reset').click();
    const reset = await state(page, (s, st) => ({ edited: s.stems.has(st), file: !!s.fileOf({ stem: st }), sounds: Object.keys(s.project.sounds ?? {}).length }), clickStem);
    check('Reset goes back to the game’s sound', !reset.edited && !reset.file && reset.sounds === 1, JSON.stringify(reset));

    // ---- tablet: the list is a side tab
    await page.setViewportSize({ width: 1000, height: 800 });
    await page.waitForTimeout(250);
    const tablet = await page.evaluate(() => ({
      tab: document.querySelector('.tx-col-tabs .tab[data-value="textures"]')?.textContent.trim(),
      panel: !!document.querySelector('.snd-panel')?.offsetParent,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }));
    check('tablets: the side tab says Sounds and the editor stays in the centre', tablet.tab === 'Sounds' && tablet.panel && tablet.overflow <= 0, JSON.stringify(tablet));
    if (shotsDir) await page.screenshot({ path: path.join(shotsDir, 'sounds-5-tablet-1000-dark.png') });

    // ---- phone
    await page.setViewportSize({ width: 390, height: 844 });
    await page.click('.tx-tabbar-btn[data-v="textures"]');
    const tabs = await page.evaluate(() => [...document.querySelectorAll('.tx-tabbar-btn')].map((b) => b.textContent.trim()).join('|'));
    check('phone tabs say Sounds / Edit in Sounds mode', tabs.startsWith('Sounds|Edit|'), tabs);
    await page.locator('.snd-browser .tx-search-input:visible').fill('');
    await page.waitForTimeout(200);
    await page.locator('.snd-row:has-text("Stone Break")').click();
    await page.waitForFunction(() => document.querySelector('.tx-editor')?.dataset.mobile === 'editor' && !!document.querySelector('.snd-panel')?.offsetParent);
    await page.waitForSelector('.snd-var.is-edited .snd-wave');
    const overflow = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth - window.innerWidth,
      body: document.querySelector('.snd-body').scrollWidth - document.querySelector('.snd-body').clientWidth,
    }));
    check('the phone layout has no sideways scrolling', overflow.page <= 0 && overflow.body <= 0, JSON.stringify(overflow));
    await shots(page, '4-phone');
    await page.click('.snd-back');
    check('the back button returns to the list on phones', await page.evaluate(() => document.querySelector('.tx-editor')?.dataset.mobile === 'textures'));
    await page.setViewportSize({ width: 1280, height: 860 });
    await page.close();

    // ---- Bedrock
    if (doBedrock) {
      const bp = await ctx.newPage();
      watch(bp);
      await newPack(bp, base, 'E2E Bedrock Sounds', true);
      await openSounds(bp);
      check('Bedrock sounds come from sound_definitions.json', hits.defs >= 1 && (await bp.evaluate(() => document.querySelectorAll('.snd-row').length)) === 3);
      await pick(bp, 'click', 'random.click');
      await bp.locator('.snd-var-play').first().click();
      await bp.waitForFunction(() => !!window.__tx.soundState()?.player.key, null, { timeout: 15000 }).catch(() => undefined);
      check('a vanilla Bedrock sound (FSB5) is decoded and played', hits.fsb >= 1 && (await state(bp, (s) => s.player.key)) === 'pack:sounds/random/click');
      await upload(bp, 0, wavFile);
      await settled(bp, 'sounds/random/click');
      const { file: mc } = await exportPack(bp, '.mcpack');
      const bz = unzip(mc);
      const bo = bz['sounds/random/click.ogg'] && Buffer.from(bz['sounds/random/click.ogg']);
      check('the .mcpack has sounds/random/click.ogg as Ogg Vorbis', !!bo && oggInfo(bo).ok, bo ? JSON.stringify(oggInfo(bo)) : Object.keys(bz).join(', '));
      const defs = bz['sounds/sound_definitions.json'] && JSON.parse(Buffer.from(bz['sounds/sound_definitions.json']).toString());
      check('sound_definitions.json has the event of the replaced sound', !!defs && JSON.stringify(defs.sound_definitions?.['random.click']) === JSON.stringify(BEDROCK_DEFS.sound_definitions['random.click']), JSON.stringify(defs));
      await bp.close();
    }
    await ctx.close();
  } catch (err) {
    console.error(err);
    failures++;
  } finally {
    check('no page errors', !errors.length, errors.slice(0, 5).join(' | '));
    await browser.close();
    server?.stop();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(failures ? `\n${failures} check(s) failed` : '\nall sound checks passed');
  process.exit(failures ? 1 : 0);
})();
