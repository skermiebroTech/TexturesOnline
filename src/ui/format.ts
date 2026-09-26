// Pure formatting helpers (no DOM; safe under Node).

import type { Edition, GameVersion, PackFormat } from '../core/types';

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
  return `${v >= 100 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", else a date */
export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const hr = Math.round(m / 60);
  if (hr < 24) return `${hr} h ago`;
  const d = Math.round(hr / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d > 300 ? 'numeric' : undefined });
}

export function formatPackFormat(f: PackFormat | undefined): string {
  if (!f) return '';
  return f.minor ? `${f.major}.${f.minor}` : String(f.major);
}

export function editionName(e: Edition): string {
  return e === 'java' ? 'Java' : 'Bedrock';
}

export function versionGroup(v: GameVersion): string {
  if (v.edition === 'bedrock') return v.type === 'preview' ? 'Previews' : 'Releases';
  const legacy = /^1\.(\d+)/.exec(v.id);
  if (legacy) return `1.${legacy[1]}`;
  const modern = /^(\d{2})\.\d+/.exec(v.id);
  if (modern) return `${modern[1]}.x`;
  const year = v.releaseTime ? new Date(v.releaseTime).getUTCFullYear() : null;
  return year ? `Snapshots ${year}` : 'Other';
}

/** Compact name for the trigger: "Latest release (26.50)" -> "26.50 (latest)" */
export function shortVersionName(name: string): string {
  const m = /^Latest (release|preview) \((.+)\)$/.exec(name);
  if (m) return m[1] === 'release' ? `${m[2]} (latest)` : `${m[2]} (preview)`;
  return name;
}

export function shortDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

/** Does a file match an accept string like '.zip,.mcpack,image/*'? Empty accept = anything. */
export function fileMatchesAccept(file: { name: string; type: string }, accept: string): boolean {
  const tokens = accept
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (!tokens.length) return true;
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();
  return tokens.some((t) => {
    if (t.startsWith('.')) return name.endsWith(t);
    if (t.endsWith('/*')) return type.startsWith(t.slice(0, -1));
    return type === t;
  });
}

export function describeAccept(accept: string): string {
  const exts = accept
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.startsWith('.'));
  if (!exts.length) return 'this kind of file';
  if (exts.length === 1) return `a ${exts[0]} file`;
  return `${exts.slice(0, -1).join(', ')} or ${exts[exts.length - 1]} files`;
}

