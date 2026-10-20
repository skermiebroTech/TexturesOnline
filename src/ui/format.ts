// Pure formatting helpers (no DOM; safe under Node).

import type { Edition, GameVersion, PackFormat } from '../core/types';
import { fmt, intlLocale, joinList, num, textLocale } from '../i18n/editor-text';
import { kit } from './i18n/kit';

/** Human readable byte size: 1.4 MB */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const digits = v >= 100 ? 0 : 1;
  return `${textLocale() === 'en' ? v.toFixed(digits) : num(v, { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${units[i]}`;
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", else a date */
export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return kit.time.justNow;
  const m = Math.round(s / 60);
  if (m < 60) return fmt(kit.time.minutes, { n: m });
  const hr = Math.round(m / 60);
  if (hr < 24) return fmt(kit.time.hours, { n: hr });
  const d = Math.round(hr / 24);
  if (d === 1) return kit.time.yesterday;
  if (d < 7) return fmt(kit.time.days, { n: d });
  return new Date(ts).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: d > 300 ? 'numeric' : undefined });
}

export function formatPackFormat(f: PackFormat | undefined): string {
  if (!f) return '';
  return f.minor ? `${f.major}.${f.minor}` : String(f.major);
}

export function editionName(e: Edition): string {
  return e === 'java' ? kit.edition.java : kit.edition.bedrock;
}

export function versionGroup(v: GameVersion): string {
  if (v.edition === 'bedrock') return v.type === 'preview' ? kit.versions.previews : kit.versions.releases;
  const legacy = /^1\.(\d+)/.exec(v.id);
  if (legacy) return `1.${legacy[1]}`;
  const modern = /^(\d{2})\.\d+/.exec(v.id);
  if (modern) return `${modern[1]}.x`;
  const year = v.releaseTime ? new Date(v.releaseTime).getUTCFullYear() : null;
  return year ? fmt(kit.versions.snapshotsOf, { year: String(year) }) : kit.versions.other;
}

/**
 * Groups a newest-first version list for display. Each group appears once, in order of its newest
 * member; weekly snapshots are grouped by year because they interleave with the release lines.
 */
export function groupVersions(list: GameVersion[]): { label: string; items: GameVersion[] }[] {
  const groups = new Map<string, GameVersion[]>();
  for (const v of list) {
    const key = versionGroup(v);
    const items = groups.get(key);
    if (items) items.push(v);
    else groups.set(key, [v]);
  }
  return Array.from(groups, ([label, items]) => ({ label, items }));
}

/**
 * Name shown in the version list and picker button. Java snapshots use their id ("26.3-rc-2",
 * "24w14a"): Mojang's long names ("26.3 Release Candidate 2") would be cut off in a narrow list.
 */
export function listVersionName(v: GameVersion): string {
  return v.edition === 'java' && v.type === 'snapshot' ? v.id : versionName(v.name);
}

/** A version name in the text's language: "Latest release (26.50)" is made in English by the data layer. */
export function versionName(name: string): string {
  const m = /^Latest (release|preview)(?: \((.+)\))?$/.exec(name);
  if (!m) return name;
  const release = m[1] === 'release';
  if (!m[2]) return release ? kit.versions.latestRelease : kit.versions.latestPreview;
  return fmt(release ? kit.versions.latestReleaseOf : kit.versions.latestPreviewOf, { version: m[2] });
}

/** Compact name for the trigger: "Latest release (26.50)" -> "26.50 (latest)" */
export function shortVersionName(name: string): string {
  const m = /^Latest (release|preview) \((.+)\)$/.exec(name);
  if (m) return fmt(m[1] === 'release' ? kit.versions.latestShort : kit.versions.previewShort, { version: m[2] });
  return versionName(name);
}

export function shortDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(dateLocale(), { month: 'short', year: 'numeric' });
}

/** Dates follow the browser in English (as before) and the page's language otherwise. */
function dateLocale(): string | undefined {
  return textLocale() === 'en' ? undefined : intlLocale();
}

// Some drag sources and platforms report no MIME type; fall back to the file extension.
const TYPE_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  zip: 'application/zip',
  jar: 'application/java-archive',
  json: 'application/json',
};

/** Does a file match an accept string like '.zip,.mcpack,image/*'? Empty accept = anything. */
export function fileMatchesAccept(file: { name: string; type: string }, accept: string): boolean {
  const tokens = accept
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (!tokens.length) return true;
  const name = file.name.toLowerCase();
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1) : '';
  const type = (file.type || TYPE_BY_EXT[ext] || '').toLowerCase();
  return tokens.some((t) => {
    if (t.startsWith('.')) return name.endsWith(t);
    if (t.endsWith('/*')) return type.startsWith(t.slice(0, -1));
    return type === t;
  });
}

const TYPE_LABEL: Record<string, () => string> = {
  'image/*': () => kit.accept.image,
  'image/png': () => kit.accept.png,
  'image/jpeg': () => kit.accept.jpeg,
  'application/zip': () => kit.accept.zip,
  'application/json': () => kit.accept.json,
};

export function describeAccept(accept: string): string {
  const tokens = accept
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const exts = tokens.filter((t) => t.startsWith('.'));
  if (!exts.length) {
    const labels = tokens.map((t) => TYPE_LABEL[t.toLowerCase()]?.()).filter((l): l is string => !!l);
    if (labels.length) return joinList(labels, 'or');
    return kit.accept.any;
  }
  if (exts.length === 1) return fmt(kit.accept.oneExt, { ext: exts[0] });
  return fmt(kit.accept.exts, { list: joinList(exts, 'or') });
}

