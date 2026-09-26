import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  describeAccept,
  fileMatchesAccept,
  formatBytes,
  formatPackFormat,
  shortVersionName,
  timeAgo,
  versionGroup,
} from '../../src/ui/format';
import { hsvToRgb, luminance, parseHex, rgbToHsv, rgbaCss, toHex } from '../../src/ui/color';
import { logoSvgMarkup } from '../../src/ui/logo';
import type { GameVersion } from '../../src/core/types';

test('formatBytes', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1023), '1023 B');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(41_483_720), '39.6 MB');
  assert.equal(formatBytes(-1), '');
});

test('timeAgo', () => {
  const now = Date.UTC(2026, 8, 26, 12);
  assert.equal(timeAgo(now - 10_000, now), 'just now');
  assert.equal(timeAgo(now - 5 * 60_000, now), '5 min ago');
  assert.equal(timeAgo(now - 3 * 3600_000, now), '3 h ago');
  assert.equal(timeAgo(now - 26 * 3600_000, now), 'yesterday');
  assert.equal(timeAgo(now - 3 * 86400_000, now), '3 days ago');
  assert.ok(timeAgo(now - 40 * 86400_000, now).length > 0);
});

test('pack format and version labels', () => {
  assert.equal(formatPackFormat({ major: 97, minor: 1 }), '97.1');
  assert.equal(formatPackFormat({ major: 34, minor: 0 }), '34');
  assert.equal(formatPackFormat(undefined), '');
  assert.equal(shortVersionName('Latest release (26.50)'), '26.50 (latest)');
  assert.equal(shortVersionName('Latest preview (26.60.28)'), '26.60.28 (preview)');
  assert.equal(shortVersionName('1.21.11'), '1.21.11');
  const v = (id: string, extra: Partial<GameVersion> = {}): GameVersion => ({ edition: 'java', id, name: id, type: 'release', ...extra });
  assert.equal(versionGroup(v('1.21.11')), '1.21');
  assert.equal(versionGroup(v('1.8.9')), '1.8');
  assert.equal(versionGroup(v('26.3')), '26.x');
  assert.equal(versionGroup(v('26.4-snapshot-1', { type: 'snapshot' })), '26.x');
  assert.equal(versionGroup(v('24w14a', { type: 'snapshot', releaseTime: '2024-04-03T12:00:00Z' })), 'Snapshots 2024');
  assert.equal(versionGroup({ edition: 'bedrock', id: 'preview', name: 'Latest preview', type: 'preview' }), 'Previews');
  assert.equal(versionGroup({ edition: 'bedrock', id: 'latest', name: 'Latest release', type: 'release' }), 'Releases');
});

test('fileMatchesAccept handles extensions, wildcards and exact types', () => {
  assert.ok(fileMatchesAccept({ name: 'Pack.ZIP', type: '' }, '.zip,.mcpack'));
  assert.ok(fileMatchesAccept({ name: 'x.mcpack', type: 'application/octet-stream' }, '.zip,.mcpack'));
  assert.ok(!fileMatchesAccept({ name: 'x.png', type: 'image/png' }, '.zip,.mcpack'));
  assert.ok(fileMatchesAccept({ name: 'skin', type: 'image/png' }, 'image/*'));
  assert.ok(fileMatchesAccept({ name: 'skin.png', type: 'image/png' }, 'image/png'));
  assert.ok(fileMatchesAccept({ name: 'anything', type: '' }, ''));
  assert.equal(describeAccept('.zip,.mcpack'), '.zip or .mcpack files');
  assert.equal(describeAccept('.png'), 'a .png file');
});

test('hex parsing and formatting', () => {
  assert.deepEqual(parseHex('#5bd35b'), [91, 211, 91, 255]);
  assert.deepEqual(parseHex('fff'), [255, 255, 255, 255]);
  assert.deepEqual(parseHex('#0008'), [0, 0, 0, 136]);
  assert.deepEqual(parseHex('#11223344'), [17, 34, 51, 68]);
  assert.equal(parseHex('#12345'), null);
  assert.equal(parseHex('zzz'), null);
  assert.equal(toHex([91, 211, 91, 255]), '#5bd35b');
  assert.equal(toHex([91, 211, 91, 128], true), '#5bd35b80');
  assert.equal(toHex([91, 211, 91, 255], true), '#5bd35b');
  assert.equal(rgbaCss([10, 20, 30, 255]), '#0a141e');
  assert.equal(rgbaCss([10, 20, 30, 0]), 'rgba(10, 20, 30, 0)');
});

test('rgb <-> hsv round trips for every 17th colour', () => {
  for (let r = 0; r < 256; r += 17)
    for (let g = 0; g < 256; g += 17)
      for (let b = 0; b < 256; b += 17) {
        const [hh, s, v] = rgbToHsv(r, g, b);
        assert.deepEqual(hsvToRgb(hh, s, v), [r, g, b]);
      }
  assert.deepEqual(rgbToHsv(255, 0, 0), [0, 1, 1]);
  assert.deepEqual(hsvToRgb(120, 1, 1), [0, 255, 0]);
  assert.deepEqual(hsvToRgb(-120, 1, 1), [0, 0, 255]);
  assert.ok(Math.abs(luminance(255, 255, 255) - 1) < 1e-9);
});

test('logo markup is deterministic SVG', () => {
  const a = logoSvgMarkup();
  assert.equal(a, logoSvgMarkup());
  assert.match(a, /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 32 32">/);
  assert.equal((a.match(/<polygon/g) ?? []).length, 48);
});
