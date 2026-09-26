import type { PackFormat } from '../../core/types';

/*
 * Resource pack formats that can be known without touching a jar.
 * Releases 1.6.1-26.3 are listed explicitly (≤1.13.2 jars have no version.json; the rest are
 * bundled so the app works offline). Newer versions resolve via misode's summary or version.json.
 */

/** First resource-pack snapshot (13w24a). Everything older used texture packs. */
export const FIRST_RESOURCE_PACK_TIME = '2013-06-13T15:32:23+00:00';
/** First snapshot whose jar contains version.json (18w47b). */
export const FIRST_VERSION_JSON_TIME = '2018-11-23T10:46:41+00:00';

const RELEASE_TABLE: [string, string[]][] = [
  ['1', ['1.6.1', '1.6.2', '1.6.4', '1.7.2', '1.7.3', '1.7.4', '1.7.5', '1.7.6', '1.7.7', '1.7.8', '1.7.9', '1.7.10',
    '1.8', '1.8.1', '1.8.2', '1.8.3', '1.8.4', '1.8.5', '1.8.6', '1.8.7', '1.8.8', '1.8.9']],
  ['2', ['1.9', '1.9.1', '1.9.2', '1.9.3', '1.9.4', '1.10', '1.10.1', '1.10.2']],
  ['3', ['1.11', '1.11.1', '1.11.2', '1.12', '1.12.1', '1.12.2']],
  ['4', ['1.13', '1.13.1', '1.13.2', '1.14', '1.14.1', '1.14.2', '1.14.3', '1.14.4']],
  ['5', ['1.15', '1.15.1', '1.15.2', '1.16', '1.16.1']],
  ['6', ['1.16.2', '1.16.3', '1.16.4', '1.16.5']],
  ['7', ['1.17', '1.17.1']],
  ['8', ['1.18', '1.18.1', '1.18.2']],
  ['9', ['1.19', '1.19.1', '1.19.2']],
  ['12', ['1.19.3']],
  ['13', ['1.19.4']],
  ['15', ['1.20', '1.20.1']],
  ['18', ['1.20.2']],
  ['22', ['1.20.3', '1.20.4']],
  ['32', ['1.20.5', '1.20.6']],
  ['34', ['1.21', '1.21.1']],
  ['42', ['1.21.2', '1.21.3']],
  ['46', ['1.21.4']],
  ['55', ['1.21.5']],
  ['63', ['1.21.6']],
  ['64', ['1.21.7', '1.21.8']],
  ['69.0', ['1.21.9', '1.21.10']],
  ['75.0', ['1.21.11']],
  ['84.0', ['26.1', '26.1.1', '26.1.2']],
  ['88.0', ['26.2']],
  ['97.1', ['26.3']],
];

export function parsePackFormat(s: string | number): PackFormat {
  if (typeof s === 'number') return { major: Math.trunc(s), minor: 0 };
  const [maj, min] = s.split('.');
  return { major: Number(maj), minor: min ? Number(min) : 0 };
}

export function formatPackFormat(f: PackFormat): string {
  return f.minor ? `${f.major}.${f.minor}` : String(f.major);
}

export function comparePackFormats(a: PackFormat, b: PackFormat): number {
  return a.major - b.major || a.minor - b.minor;
}

/** Release id -> resource pack format, for every release from 1.6.1 to 26.3. */
export const KNOWN_RELEASE_FORMATS: Readonly<Record<string, PackFormat>> = Object.freeze(
  Object.fromEntries(RELEASE_TABLE.flatMap(([fmt, ids]) => ids.map((id) => [id, parsePackFormat(fmt)]))),
);

/** Releases in the bundled table, oldest first. */
export const KNOWN_RELEASES: readonly string[] = RELEASE_TABLE.flatMap(([, ids]) => ids);

/** Releases ≤ 1.13.x by id (dates don't work: 1.8.9 shipped after the first format-2 snapshot). */
export function legacyRpFormatForRelease(id: string): number | null {
  const m = /^1\.(\d+)(?:\.\d+)?$/.exec(id.trim());
  if (!m) return null;
  const minor = Number(m[1]);
  if (minor < 6) return null;
  if (minor <= 8) return 1;
  if (minor <= 10) return 2;
  if (minor <= 12) return 3;
  if (minor <= 14) return 4;
  return null;
}

/** First snapshot of each pre-version.json format, by release time. */
export const SNAPSHOT_THRESHOLDS: readonly [string, number][] = [
  ['2013-06-13T15:32:23+00:00', 1], // 13w24a
  ['2015-07-29T13:24:33+00:00', 2], // 15w31a
  ['2016-08-10T12:30:10+00:00', 3], // 16w32a
  ['2017-11-27T15:36:33+00:00', 4], // 17w48a (4 lasts until 19w46b)
];

/** Format for snapshots without version.json (≤ 18w47a), by release time. */
export function legacyRpFormatForSnapshot(releaseTime: string): number | null {
  const t = Date.parse(releaseTime);
  if (!Number.isFinite(t)) return null;
  if (t >= Date.parse(FIRST_VERSION_JSON_TIME)) return null;
  let fmt: number | null = null;
  for (const [time, f] of SNAPSHOT_THRESHOLDS) if (t >= Date.parse(time)) fmt = f;
  return fmt;
}

/** Bundled lookup: known release, or legacy rules for old releases/snapshots. */
export function bundledPackFormat(id: string, releaseTime?: string, type?: string): PackFormat | null {
  const known = KNOWN_RELEASE_FORMATS[id];
  if (known) return { ...known };
  if (type !== 'snapshot') {
    const legacy = legacyRpFormatForRelease(id);
    if (legacy !== null) return { major: legacy, minor: 0 };
  }
  if (releaseTime) {
    const snap = legacyRpFormatForSnapshot(releaseTime);
    if (snap !== null) return { major: snap, minor: 0 };
  }
  return null;
}

/** Reads the resource pack format from a jar's version.json (all three historical shapes). */
export function packFormatFromVersionJson(vj: unknown): PackFormat | null {
  const pv = (vj as { pack_version?: unknown } | null)?.pack_version;
  if (pv == null) return null;
  if (typeof pv === 'number') return { major: pv, minor: 0 };
  if (typeof pv === 'object') {
    const o = pv as Record<string, unknown>;
    if (typeof o.resource_major === 'number') return { major: o.resource_major, minor: typeof o.resource_minor === 'number' ? o.resource_minor : 0 };
    if (typeof o.resource === 'number') return { major: o.resource, minor: 0 };
  }
  return null;
}

/** Newest bundled release whose format is ≤ the given one (to guess a version for an imported pack). */
export function guessReleaseForFormat(f: PackFormat): string | null {
  let best: string | null = null;
  for (const id of KNOWN_RELEASES) {
    if (comparePackFormats(KNOWN_RELEASE_FORMATS[id], f) <= 0) best = id;
  }
  return best;
}

/** All bundled releases with exactly this major format. */
export function releasesForFormat(major: number): string[] {
  return KNOWN_RELEASES.filter((id) => KNOWN_RELEASE_FORMATS[id].major === major);
}
