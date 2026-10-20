import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  javaCatalogFromFiles,
  javaSoundStem,
  parseBedrockDefinitions,
  parseJavaSoundsJson,
  searchSoundEvents,
  soundCategory,
  soundEventName,
  soundStemOfPath,
} from '../../src/tools/textures/sounds/catalog';
import {
  definitionsForStem,
  editedSoundStems,
  isOggVorbisStart,
  mergeBedrockDefinitions,
  prepareSoundExport,
  removeSoundFile,
  setSoundFile,
  soundFileOf,
} from '../../src/tools/textures/sounds/pack';
import { inspectOgg, oggCrc } from '../../src/tools/textures/sounds/ogg';
import { encodeVorbis } from '../../src/tools/textures/sounds/vorbis';
import { decodeFadpcm, decodeFsb5, isFsb5 } from '../../src/tools/textures/sounds/fsb';
import { clampParams, mix, normaliseGain, peakOf, renderSamples, soundRange, waveformPeaks, MIN_LENGTH } from '../../src/tools/textures/sounds/render';
import { mcmetaSoundsUrls, soundFilesFromIndex } from '../../src/tools/textures/sounds/vanilla';
import { exportTexturePack } from '../../src/tools/textures/export';
import { newTextureProject } from '../../src/tools/textures/project';
import type { SoundEdit } from '../../src/core/types';
import { bedrockSpec, fakeAssets, javaSpec, json, unzipBlob } from '../tools/texlogic/fixtures';

const require = createRequire(import.meta.url);
const WASM = new Uint8Array(readFileSync(require.resolve('wasm-media-encoders/wasm/ogg.wasm')));

// ---------------------------------------------------------------------------------------------
// Fixtures: the shapes of the game's files, with made-up content

const SOUNDS_JSON = {
  'block.stone.break': { sounds: ['block/stone/break1', 'minecraft:block/stone/break2', { name: 'block/stone/break3', volume: 0.8, weight: 2 }], subtitle: 'subtitles.block.generic.break' },
  'block.stone.step': { sounds: ['block/stone/break1', { name: 'step/stone1', pitch: 1.2 }] },
  'entity.creeper.primed': { sounds: ['random/fuse'], subtitle: 'subtitles.entity.creeper.primed' },
  'entity.zombie.ambient': { sounds: ['mob/zombie/say1', { name: 'entity.creeper.primed', type: 'event' }] },
  'music_disc.cat': { sounds: [{ name: 'records/cat', stream: true }] },
  'music.game': { sounds: [{ name: 'music/game/calm1', stream: true, volume: 0.4 }] },
  'ui.button.click': { sounds: ['random/click'] },
  'ambient.cave': { sounds: ['ambient/cave/cave1'] },
  'weather.rain': { sounds: ['ambient/weather/rain1'] },
  'item.armor.equip_iron': { sounds: ['item/armor/equip_iron1'] },
  'intentionally_empty': { sounds: [] },
  'enchant.thorns.hit': { sounds: ['enchant/thorns/hit1'] },
};

const DEFINITIONS = {
  format_version: '1.20.20',
  sound_definitions: {
    'dig.stone': { category: 'block', sounds: ['sounds/dig/stone1', 'sounds/dig/stone2', { name: 'sounds/dig/stone2', volume: 0.5 }] },
    'step.stone': { category: 'player', sounds: [{ name: 'sounds/dig/stone1', volume: 0.3 }] },
    'mob.creeper.say': { category: 'hostile', sounds: ['sounds/mob/creeper/say1'] },
    'random.click': { category: 'ui', sounds: ['sounds/random/click'] },
    'record.cat': { category: 'record', sounds: [{ name: 'sounds/music/game/records/cat', stream: true }] },
    'ambient.weather.rain': { category: 'weather', sounds: ['sounds/ambient/weather/rain1'] },
    'random.explode': { category: 'block', sounds: ['sounds/random/explode1'] },
    'random.levelup': { category: 'player', sounds: ['sounds/random/levelup'] },
    'empty.one': { category: 'neutral', sounds: [] },
  },
};

// ---------------------------------------------------------------------------------------------
// Catalog

test('Java sounds.json: events, categories, variant paths and pretty names', () => {
  const cat = parseJavaSoundsJson(SOUNDS_JSON, '26.3');
  assert.equal(cat.edition, 'java');
  assert.equal(cat.source, 'sounds.json');
  assert.ok(!cat.byId.has('intentionally_empty'), 'events without sounds are left out');
  const brk = cat.byId.get('block.stone.break')!;
  assert.equal(brk.name, 'Stone Break');
  assert.equal(brk.category, 'block');
  assert.deepEqual(
    brk.variants.map((v) => v.path),
    ['assets/minecraft/sounds/block/stone/break1.ogg', 'assets/minecraft/sounds/block/stone/break2.ogg', 'assets/minecraft/sounds/block/stone/break3.ogg'],
  );
  assert.equal(brk.variants[2].volume, 0.8);
  assert.equal(brk.variants[2].weight, 2);
  assert.equal(cat.byId.get('block.stone.step')!.variants[1].pitch, 1.2);
  assert.equal(cat.byId.get('music_disc.cat')!.category, 'records');
  assert.equal(cat.byId.get('music_disc.cat')!.name, 'Cat');
  assert.equal(cat.byId.get('music_disc.cat')!.variants[0].stream, true);
  assert.equal(cat.byId.get('music.game')!.category, 'music');
  assert.equal(cat.byId.get('ui.button.click')!.category, 'ui');
  assert.equal(cat.byId.get('ambient.cave')!.category, 'ambient');
  assert.equal(cat.byId.get('weather.rain')!.category, 'weather');
  assert.equal(cat.byId.get('item.armor.equip_iron')!.category, 'item');
  assert.equal(cat.byId.get('entity.creeper.primed')!.category, 'entity');
  assert.equal(cat.byId.get('enchant.thorns.hit')!.category, 'other');
  // "type": "event" entries bring the other event's files
  const zombie = cat.byId.get('entity.zombie.ambient')!;
  assert.deepEqual(zombie.refs, ['entity.creeper.primed']);
  assert.deepEqual(zombie.variants.map((v) => v.name), ['mob/zombie/say1', 'random/fuse']);
  // a file shared by two events knows both
  assert.deepEqual(cat.users.get('assets/minecraft/sounds/block/stone/break1')!.sort(), ['block.stone.break', 'block.stone.step']);
  // sorted by category, then id
  const order = cat.events.map((e) => e.category);
  assert.equal(order[0], 'ambient');
  assert.equal(order.at(-1), 'other');
});

test('Java without sounds.json: one entry per group of numbered files', () => {
  const cat = javaCatalogFromFiles(
    ['minecraft/sounds/dig/stone1.ogg', 'minecraft/sounds/dig/stone2.ogg', 'minecraft/sounds/dig/stone10.ogg', 'minecraft/sounds/mob/cow/say1.ogg', 'minecraft/sounds/random/click.ogg', 'minecraft/sounds/records/cat.ogg', 'minecraft/sounds.json'],
    '1.12.2',
  );
  assert.equal(cat.source, 'files');
  assert.deepEqual(cat.byId.get('dig.stone')!.variants.map((v) => v.name), ['dig/stone1', 'dig/stone2', 'dig/stone10']);
  assert.equal(cat.byId.get('dig.stone')!.category, 'block');
  assert.equal(cat.byId.get('mob.cow.say')!.category, 'entity');
  assert.equal(cat.byId.get('records.cat')!.category, 'records');
  assert.equal(cat.byId.get('random.click')!.variants[0].path, 'assets/minecraft/sounds/random/click.ogg');
});

test('Bedrock sound_definitions.json: categories, unique files, definitions kept, old flat format', () => {
  const cat = parseBedrockDefinitions(DEFINITIONS, 'latest');
  assert.equal(cat.edition, 'bedrock');
  assert.equal(cat.formatVersion, '1.20.20');
  assert.ok(!cat.byId.has('empty.one'));
  const dig = cat.byId.get('dig.stone')!;
  assert.equal(dig.category, 'block');
  assert.deepEqual(dig.variants.map((v) => v.path), ['sounds/dig/stone1.ogg', 'sounds/dig/stone2.ogg'], 'a file listed twice shows once');
  assert.equal(cat.byId.get('step.stone')!.category, 'block');
  assert.equal(cat.byId.get('mob.creeper.say')!.category, 'entity');
  assert.equal(cat.byId.get('mob.creeper.say')!.name, 'Creeper Say');
  assert.equal(cat.byId.get('random.click')!.category, 'ui', 'unknown prefix: the definition category decides');
  assert.equal(cat.byId.get('random.levelup')!.category, 'entity');
  assert.equal(cat.byId.get('record.cat')!.category, 'records');
  assert.equal(cat.byId.get('ambient.weather.rain')!.category, 'ambient');
  assert.deepEqual(cat.users.get('sounds/dig/stone1')!.sort(), ['dig.stone', 'step.stone']);
  assert.ok(cat.definitions && 'dig.stone' in cat.definitions);
  const flat = parseBedrockDefinitions(DEFINITIONS.sound_definitions, 'latest');
  assert.equal(flat.events.length, cat.events.length);
  assert.throws(() => parseBedrockDefinitions([], 'latest'));
});

test('names, categories, stems and search', () => {
  assert.equal(soundEventName('block.wooden_door.open'), 'Wooden Door Open');
  assert.equal(soundEventName('enchant.thorns.hit'), 'Enchant Thorns Hit');
  assert.equal(soundCategory('bedrock', 'random.anvil_use', 'block'), 'block');
  assert.equal(javaSoundStem('mymod:sfx/boom'), 'assets/mymod/sounds/sfx/boom');
  assert.equal(soundStemOfPath('java', 'assets/minecraft/sounds/block/stone/break1.ogg'), 'assets/minecraft/sounds/block/stone/break1');
  assert.equal(soundStemOfPath('java', 'assets/minecraft/sounds/block/stone/break1.wav'), null);
  assert.equal(soundStemOfPath('java', 'assets/minecraft/sounds.json'), null);
  assert.equal(soundStemOfPath('bedrock', 'sounds/dig/stone1.fsb'), 'sounds/dig/stone1');
  assert.equal(soundStemOfPath('bedrock', 'sounds/sound_definitions.json'), null);
  const cat = parseJavaSoundsJson(SOUNDS_JSON, '26.3');
  assert.equal(searchSoundEvents(cat.events, 'creeper')[0].id, 'entity.creeper.primed');
  assert.deepEqual(searchSoundEvents(cat.events, 'stone break').map((e) => e.id), ['block.stone.break', 'block.stone.step']);
  assert.equal(searchSoundEvents(cat.events, 'fuse')[0].id, 'entity.creeper.primed', 'file names are searched too');
  assert.equal(searchSoundEvents(cat.events, 'nothing-like-this').length, 0);
  assert.equal(searchSoundEvents(cat.events, '  ').length, cat.events.length);
});

test('asset index: sound files and hashes; sounds.json mirror URLs', () => {
  const r = soundFilesFromIndex({
    objects: {
      'minecraft/sounds.json': { hash: 'aa' },
      'minecraft/sounds/block/stone/break1.ogg': { hash: 'bb11' },
      'minecraft/sounds/music/game/calm1.ogg': { hash: 'cc22' },
      'minecraft/lang/de_de.json': { hash: 'dd' },
      'icons/icon_16x16.png': { hash: 'ee' },
    },
  });
  assert.deepEqual(r, { files: ['block/stone/break1', 'music/game/calm1'], hashes: ['bb11', 'cc22'], hasSoundsJson: true });
  assert.throws(() => soundFilesFromIndex({}));
  const urls = mcmetaSoundsUrls('26.4-snapshot-4');
  assert.match(urls[0], /^https:\/\/raw\.githubusercontent\.com\/misode\/mcmeta\/26\.4-snapshot-4-assets\/assets\/minecraft\/sounds\.json$/);
  assert.match(urls[1], /^https:\/\/cdn\.jsdelivr\.net\/gh\/misode\/mcmeta@26\.4-snapshot-4-assets\//);
});

// ---------------------------------------------------------------------------------------------
// Rendering

test('render: trim, volume, mono mix, fades and clipping', () => {
  const sr = 1000;
  const l = new Float32Array(2000).fill(0.5);
  const r = new Float32Array(2000).fill(-0.1);
  const out = renderSamples([l, r], sr, { start: 0.5, end: 1.5, gain: 1, stereo: false });
  assert.equal(out.length, 1);
  assert.equal(out[0].length, 1000);
  assert.ok(Math.abs(out[0][500] - 0.2) < 1e-6, 'mono is the average of both channels');
  assert.equal(out[0][0], 0, 'fades in from silence');
  assert.equal(out[0][999], 0, 'fades out to silence');
  const st = renderSamples([l, r], sr, { start: 0, end: 2, gain: 4, stereo: true });
  assert.equal(st.length, 2);
  assert.equal(st[0][1000], 1, 'clipped at 1');
  assert.ok(Math.abs(st[1][1000] + 0.4) < 1e-6);
  assert.equal(renderSamples([l], sr, { start: 0, end: 2, gain: 1, stereo: true }).length, 1, 'stereo needs two channels');
  const c = clampParams({ start: 1.99, end: 5, gain: 9, stereo: false }, 2);
  assert.ok(c.end - c.start >= MIN_LENGTH - 1e-9);
  assert.equal(c.end, 2);
  assert.equal(c.gain, 4);
  assert.deepEqual(Array.from(mix([new Float32Array([1, 0]), new Float32Array([0, 1])])), [0.5, 0.5]);
});

test('render: peak, normalise, silence range and waveform peaks', () => {
  const sr = 1000;
  const s = new Float32Array(3000);
  for (let i = 1000; i < 2000; i++) s[i] = Math.sin(i / 10) * 0.25;
  assert.ok(Math.abs(peakOf([s], sr) - 0.25) < 0.01);
  assert.equal(peakOf([s], sr, 0, 0.9), 0);
  const g = normaliseGain([s], sr, 0, 3);
  assert.ok(g > 3.6 && g < 3.9, `normalise gain ${g}`);
  assert.equal(normaliseGain([new Float32Array(100)], sr, 0, 0.1), 1, 'silence stays as it is');
  const range = soundRange([s], sr);
  assert.ok(range.start > 0.95 && range.start < 1.0, `start ${range.start}`);
  assert.ok(range.end > 2.0 && range.end < 2.05, `end ${range.end}`);
  const p = waveformPeaks([s], 3);
  assert.equal(p.length, 6);
  assert.equal(p[0], 0);
  assert.ok(p[3] > 0.24 && p[2] < -0.24);
});

// ---------------------------------------------------------------------------------------------
// Ogg Vorbis encoding

function sine(n: number, sr: number, hz: number, amp = 0.5): Float32Array {
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = amp * Math.sin((2 * Math.PI * hz * i) / sr);
  return a;
}

test('Vorbis encoder: valid Ogg stream (CRCs, headers, granule = samples), mono and stereo', async () => {
  const mono = await encodeVorbis([sine(44100, 44100, 440)], 44100, WASM, 4, 1234);
  assert.ok(isOggVorbisStart(mono));
  const info = inspectOgg(mono)!;
  assert.equal(info.codec, 'vorbis');
  assert.equal(info.channels, 1);
  assert.equal(info.sampleRate, 44100);
  assert.equal(info.samples, 44100, 'last granule position = samples per channel');
  assert.equal(info.duration, 1);
  assert.ok(info.crcOk, 'every page checksum is right');
  assert.ok(info.bos && info.eos, 'begin and end of stream flags');
  assert.ok(info.vorbisHeaders, 'identification, comment and setup headers');
  assert.ok(info.packets > 3);
  assert.match(info.vendor ?? '', /libVorbis/);
  assert.ok(mono.length > 1000 && mono.length < 40000, `size ${mono.length}`);

  const n = 48000 * 2 + 123;
  const stereo = await encodeVorbis([sine(n, 48000, 300), sine(n, 48000, 600, 0.3)], 48000, WASM);
  const si = inspectOgg(stereo)!;
  assert.equal(si.channels, 2);
  assert.equal(si.sampleRate, 48000);
  assert.equal(si.samples, n);
  assert.ok(si.crcOk && si.eos && si.vorbisHeaders);

  // a damaged byte is caught by the page checksum
  const bad = mono.slice();
  bad[Math.floor(bad.length / 2)] ^= 0x55;
  assert.equal(inspectOgg(bad)?.crcOk, false);
  await assert.rejects(encodeVorbis([sine(10, 44100, 1), sine(10, 44100, 1), sine(10, 44100, 1)], 44100, WASM), /mono or stereo/);
});

test('Ogg reader: Opus and non-Ogg files', () => {
  // one page holding an OpusHead packet
  const head = new Uint8Array([...new TextEncoder().encode('OpusHead'), 1, 2, 0x38, 0x01, 0x80, 0xbb, 0, 0, 0, 0, 0]);
  const page = new Uint8Array(27 + 1 + head.length);
  page.set(new TextEncoder().encode('OggS'));
  page[5] = 2 | 4;
  new DataView(page.buffer).setBigInt64(6, 48312n + 312n, true);
  page[26] = 1;
  page[27] = head.length;
  page.set(head, 28);
  new DataView(page.buffer).setUint32(22, oggCrc(page), true);
  const info = inspectOgg(page)!;
  assert.equal(info.codec, 'opus');
  assert.equal(info.channels, 2);
  assert.ok(info.crcOk);
  assert.equal(info.samples, 48312);
  assert.equal(isOggVorbisStart(page), false);
  assert.equal(inspectOgg(new TextEncoder().encode('RIFF....WAVEfmt ')), null);
});

// ---------------------------------------------------------------------------------------------
// FSB5 / FADPCM

const COEFS = [
  [0, 0],
  [60, 0],
  [122, 60],
  [115, 52],
  [98, 55],
];

/** A small FADPCM encoder (search over coefficients and shifts per 32 samples, like the format allows). */
function encodeFadpcm(pcm: Int16Array): Uint8Array {
  const frames = Math.ceil(pcm.length / 256);
  const out = new Uint8Array(frames * 0x8c);
  const dv = new DataView(out.buffer);
  let h1 = 0;
  let h2 = 0;
  for (let f = 0; f < frames; f++) {
    const o = f * 0x8c;
    dv.setInt16(o + 8, h1, true);
    dv.setInt16(o + 10, h2, true);
    let coefs = 0;
    let shifts = 0;
    for (let g = 0; g < 8; g++) {
      let best: { err: number; idx: number; sh: number; nib: number[]; h1: number; h2: number } | null = null;
      for (let idx = 0; idx < 5; idx++) {
        for (let sh = 0; sh <= 12; sh++) {
          let a = h1;
          let b = h2;
          let err = 0;
          const nib: number[] = [];
          for (let k = 0; k < 32; k++) {
            const target = pcm[f * 256 + g * 32 + k] ?? 0;
            const pred = (a * COEFS[idx][0] - b * COEFS[idx][1]) >> 6;
            let q = Math.round(((target - pred) * 64) / 64 / (1 << sh));
            q = Math.max(-8, Math.min(7, q));
            let s = ((((q & 0xf) << 28) >> (22 - sh)) - b * COEFS[idx][1] + a * COEFS[idx][0]) >> 6;
            s = Math.max(-32768, Math.min(32767, s));
            err += (s - target) ** 2;
            nib.push(q & 0xf);
            b = a;
            a = s;
          }
          if (!best || err < best.err) best = { err, idx, sh, nib, h1: a, h2: b };
        }
      }
      coefs |= best!.idx << (g * 4);
      shifts |= best!.sh << (g * 4);
      for (let j = 0; j < 4; j++) {
        let word = 0;
        for (let k = 0; k < 8; k++) word |= best!.nib[j * 8 + k] << (k * 4);
        dv.setUint32(o + 0x0c + 0x10 * g + 4 * j, word >>> 0, true);
      }
      h1 = best!.h1;
      h2 = best!.h2;
    }
    dv.setUint32(o, coefs >>> 0, true);
    dv.setUint32(o + 4, shifts >>> 0, true);
  }
  return out;
}

function fsb5(data: Uint8Array, samples: number, mode: number, rateIndex: number, channels: 1 | 2, extraRate?: number): Uint8Array {
  const chunk = extraRate ? 8 : 0;
  const headers = 8 + chunk;
  const out = new Uint8Array(0x3c + headers + data.length);
  const dv = new DataView(out.buffer);
  out.set(new TextEncoder().encode('FSB5'));
  dv.setUint32(4, 1, true);
  dv.setUint32(8, 1, true);
  dv.setUint32(12, headers, true);
  dv.setUint32(16, 0, true);
  dv.setUint32(20, data.length, true);
  dv.setUint32(24, mode, true);
  const lo = (extraRate ? 1 : 0) | (rateIndex << 1) | ((channels - 1) << 5);
  dv.setUint32(0x3c, lo >>> 0, true);
  dv.setUint32(0x40, (samples << 2) >>> 0, true);
  if (extraRate) {
    dv.setUint32(0x44, ((4 << 1) | (2 << 25)) >>> 0, true);
    dv.setUint32(0x48, extraRate, true);
  }
  out.set(data, 0x3c + headers);
  return out;
}

test('FSB5 FADPCM: decodes what an encoder wrote (sample rate chunk, sample count)', () => {
  const n = 1000;
  const pcm = new Int16Array(n);
  for (let i = 0; i < n; i++) pcm[i] = Math.round(12000 * Math.sin(i / 9) + 3000 * Math.sin(i / 2.7));
  const bank = fsb5(encodeFadpcm(pcm), n, 16, 8, 1, 25500);
  assert.ok(isFsb5(bank));
  const d = decodeFsb5(bank);
  assert.equal(d.sampleRate, 25500, 'frequency chunk wins over the rate index');
  assert.equal(d.channels.length, 1);
  assert.equal(d.channels[0].length, n);
  let sig = 0;
  let noise = 0;
  for (let i = 0; i < n; i++) {
    sig += (pcm[i] / 32768) ** 2;
    noise += (pcm[i] / 32768 - d.channels[0][i]) ** 2;
  }
  const snr = 10 * Math.log10(sig / noise);
  assert.ok(snr > 25, `SNR ${snr.toFixed(1)} dB`);
});

test('FSB5: stereo frames interleave per channel; PCM16 banks; errors', () => {
  const n = 512;
  const a = new Int16Array(n).map((_, i) => Math.round(8000 * Math.sin(i / 5)));
  const b = new Int16Array(n).map((_, i) => Math.round(-6000 * Math.sin(i / 11)));
  const ea = encodeFadpcm(a);
  const eb = encodeFadpcm(b);
  const inter = new Uint8Array(ea.length * 2);
  for (let f = 0; f < ea.length / 0x8c; f++) {
    inter.set(ea.subarray(f * 0x8c, (f + 1) * 0x8c), f * 2 * 0x8c);
    inter.set(eb.subarray(f * 0x8c, (f + 1) * 0x8c), (f * 2 + 1) * 0x8c);
  }
  const ch = decodeFadpcm(inter, 2, n);
  assert.equal(ch.length, 2);
  assert.ok(Math.abs(ch[0][100] - a[100] / 32768) < 0.02);
  assert.ok(Math.abs(ch[1][100] - b[100] / 32768) < 0.02);

  const pcm = new Uint8Array(8);
  new DataView(pcm.buffer).setInt16(0, 16384, true);
  new DataView(pcm.buffer).setInt16(2, -16384, true);
  const d = decodeFsb5(fsb5(pcm, 2, 2, 8, 2));
  assert.equal(d.sampleRate, 44100);
  assert.deepEqual([d.channels[0][0], d.channels[1][0]], [0.5, -0.5]);

  assert.throws(() => decodeFsb5(new Uint8Array(100)), /FSB5/);
  assert.throws(() => decodeFsb5(fsb5(pcm, 2, 15, 8, 1)), /codec 15/);
});

// ---------------------------------------------------------------------------------------------
// Pack files and export

const ogg = (s: string) => new Blob([new TextEncoder().encode(s)], { type: 'audio/ogg' });
const edit = (defs?: Record<string, unknown>): SoundEdit => ({ start: 0, end: 1, gain: 1, stereo: false, updatedAt: 1, ...(defs ? { definitions: defs } : {}) });

test('pack files: set, find, reset; Bedrock picks .ogg over .wav over .fsb', () => {
  const p = newTextureProject({ name: 'S', edition: 'bedrock', version: 'latest' });
  p.extraFiles['sounds/dig/stone1.fsb'] = ogg('fsb');
  p.extraFiles['sounds/dig/stone1.wav'] = ogg('wav');
  p.extraFiles['sounds/sound_definitions.json'] = ogg('{}');
  p.extraFiles['textures/blocks/stone.png'] = ogg('png');
  assert.deepEqual([...editedSoundStems(p)], ['sounds/dig/stone1']);
  assert.equal(soundFileOf(p, 'sounds/dig/stone1')!.path, 'sounds/dig/stone1.wav');
  const path = setSoundFile(p, 'sounds/dig/stone1', ogg('new'), edit());
  assert.equal(path, 'sounds/dig/stone1.ogg');
  assert.deepEqual(Object.keys(p.extraFiles).sort(), ['sounds/dig/stone1.ogg', 'sounds/sound_definitions.json', 'textures/blocks/stone.png']);
  assert.ok(p.sounds?.['sounds/dig/stone1.ogg']);
  assert.equal(removeSoundFile(p, 'sounds/dig/stone1'), true);
  assert.equal(removeSoundFile(p, 'sounds/dig/stone1'), false);
  assert.deepEqual(p.sounds, {});
  assert.equal(soundFileOf(p, 'sounds/dig/stone1'), null);

  const j = newTextureProject({ name: 'J', edition: 'java', version: '26.3' });
  j.extraFiles['assets/minecraft/sounds/random/click.ogg'] = ogg('x');
  j.extraFiles['assets/minecraft/sounds.json'] = ogg('{}');
  assert.deepEqual([...editedSoundStems(j)], ['assets/minecraft/sounds/random/click']);
});

test('Bedrock definitions: copied for every event of a file; merged without overriding the pack', () => {
  const cat = parseBedrockDefinitions(DEFINITIONS, 'latest');
  const defs = definitionsForStem(cat, 'sounds/dig/stone1')!;
  assert.deepEqual(Object.keys(defs).sort(), ['dig.stone', 'step.stone']);
  assert.deepEqual(defs['step.stone'], DEFINITIONS.sound_definitions['step.stone']);
  assert.equal(definitionsForStem(parseJavaSoundsJson(SOUNDS_JSON, '26.3'), 'x'), undefined);

  const fresh = JSON.parse(mergeBedrockDefinitions(null, [edit(defs), undefined])!);
  assert.equal(fresh.format_version, '1.14.0');
  assert.deepEqual(Object.keys(fresh.sound_definitions).sort(), ['dig.stone', 'step.stone']);

  const own = JSON.stringify({ format_version: '1.20.20', sound_definitions: { 'dig.stone': { category: 'block', sounds: ['sounds/mine/rock'] } } });
  const merged = JSON.parse(mergeBedrockDefinitions(`// comment\n${own}`, [edit(defs)])!);
  assert.deepEqual(merged.sound_definitions['dig.stone'].sounds, ['sounds/mine/rock'], "the pack's own entry wins");
  assert.ok(merged.sound_definitions['step.stone']);
  assert.equal(merged.format_version, '1.20.20');

  const flat = JSON.parse(mergeBedrockDefinitions(JSON.stringify({ 'other.sound': { sounds: [] } }), [edit(defs)])!);
  assert.ok(flat['other.sound'] && flat['dig.stone'] && !flat.sound_definitions, 'old flat files stay flat');

  assert.equal(mergeBedrockDefinitions(own, [edit({ 'dig.stone': {} })]), null, 'nothing new: unchanged');
  assert.equal(mergeBedrockDefinitions('{ broken', [edit(defs)]), null, "a file we can't read is kept as it is");
  assert.equal(mergeBedrockDefinitions(null, [edit()]), null);
});

test('export Java: edited sounds go to assets/minecraft/sounds as Ogg Vorbis; others warn', async () => {
  const vorbis = await encodeVorbis([sine(4410, 44100, 220)], 44100, WASM);
  const p = newTextureProject({ name: 'Loud', edition: 'java', version: '26.3' });
  setSoundFile(p, 'assets/minecraft/sounds/random/click', new Blob([vorbis as Uint8Array<ArrayBuffer>], { type: 'audio/ogg' }), edit());
  let res = await exportTexturePack(p, fakeAssets('java', '26.3', javaSpec()));
  let zip = await unzipBlob(res.blob);
  const out = zip['assets/minecraft/sounds/random/click.ogg'];
  assert.ok(out, 'the sound is in the zip');
  assert.deepEqual(new Uint8Array(out), vorbis);
  assert.ok(inspectOgg(new Uint8Array(out))!.crcOk);
  assert.ok(!zip['assets/minecraft/sounds.json'], 'replacing files needs no sounds.json');
  assert.deepEqual(res.warnings, []);

  // an opened pack's Opus file: kept, with a warning
  const opusHead = new Uint8Array(64);
  opusHead.set(new TextEncoder().encode('OggS'));
  opusHead[26] = 1;
  opusHead[27] = 19;
  opusHead.set(new TextEncoder().encode('OpusHead'), 28);
  p.extraFiles['assets/minecraft/sounds/mob/cow/say1.ogg'] = new Blob([opusHead]);
  res = await exportTexturePack(p, fakeAssets('java', '26.3', javaSpec()));
  zip = await unzipBlob(res.blob);
  assert.ok(zip['assets/minecraft/sounds/mob/cow/say1.ogg']);
  assert.equal(res.warnings.length, 1);
  assert.match(res.warnings[0], /isn’t Ogg Vorbis.*say1\.ogg/);
});

test('export Bedrock: sounds/... file plus sound_definitions.json entries', async () => {
  const cat = parseBedrockDefinitions(DEFINITIONS, 'latest');
  const p = newTextureProject({ name: 'Phone', edition: 'bedrock', version: 'latest' });
  setSoundFile(p, 'sounds/mob/creeper/say1', ogg('OggS fake'), edit(definitionsForStem(cat, 'sounds/mob/creeper/say1')));
  // stale editing state for a file that is gone is ignored
  p.sounds!['sounds/random/gone.ogg'] = edit({ 'random.gone': { sounds: [] } });
  const res = await exportTexturePack(p, fakeAssets('bedrock', 'latest', bedrockSpec()));
  const zip = await unzipBlob(res.blob);
  assert.ok(zip['sounds/mob/creeper/say1.ogg']);
  const defs = json(zip['sounds/sound_definitions.json']);
  assert.deepEqual(Object.keys(defs.sound_definitions), ['mob.creeper.say']);
  assert.deepEqual(defs.sound_definitions['mob.creeper.say'], DEFINITIONS.sound_definitions['mob.creeper.say']);
  assert.ok(zip['manifest.json']);
});

test('prepareSoundExport leaves projects without sounds alone', async () => {
  const p = newTextureProject({ name: 'B', edition: 'bedrock', version: 'latest' });
  const files = new Map<string, Uint8Array>();
  const warnings: string[] = [];
  await prepareSoundExport(p, files, warnings);
  assert.equal(files.size, 0);
  assert.deepEqual(warnings, []);
});
