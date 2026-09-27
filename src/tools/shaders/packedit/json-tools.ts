// JSON helpers for pack files: validation with line/column, lenient parsing (Bedrock accepts
// comments in its JSON), pretty/minify, and Bedrock manifest name + version handling. Pure.

export interface JsonCheck {
  ok: boolean;
  /** Parsed only after stripping comments / trailing commas (Bedrock style) */
  lenient?: boolean;
  message?: string;
  line?: number;
  column?: number;
}

/** Removes // and /* *\/ comments and trailing commas outside strings. */
export function stripJsonComments(text: string): string {
  let out = '';
  let i = 0;
  let inStr = false;
  while (i < text.length) {
    const c = text[i];
    if (inStr) {
      out += c;
      if (c === '\\') {
        out += text[i + 1] ?? '';
        i += 2;
        continue;
      }
      if (c === '"') inStr = false;
      i++;
      continue;
    }
    if (c === '"') {
      inStr = true;
      out += c;
      i++;
      continue;
    }
    if (c === '/' && text[i + 1] === '/') {
      // replaced by spaces so error positions still point at the original text
      while (i < text.length && text[i] !== '\n' && text[i] !== '\r') {
        out += ' ';
        i++;
      }
      continue;
    }
    if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      const chunk = end < 0 ? text.slice(i) : text.slice(i, end + 2);
      out += chunk.replace(/[^\r\n]/g, ' ');
      i += chunk.length;
      continue;
    }
    out += c;
    i++;
  }
  return out.replace(/,(\s*[}\]])/g, ' $1');
}

function position(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let col = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') {
      line++;
      col = 1;
    } else col++;
  }
  return { line, column: col };
}

function errorOffset(err: unknown, text: string): number | null {
  const msg = err instanceof Error ? err.message : String(err);
  const m = /position (\d+)/i.exec(msg);
  if (m) return Number(m[1]);
  const lc = /line (\d+) column (\d+)/i.exec(msg);
  if (lc) {
    const lines = text.split('\n');
    let off = 0;
    for (let i = 0; i < Number(lc[1]) - 1 && i < lines.length; i++) off += lines[i].length + 1;
    return off + Number(lc[2]) - 1;
  }
  if (/unexpected end/i.test(msg)) return text.length;
  return null;
}

function cleanMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/^JSON\.parse:\s*/i, '').replace(/\s*in JSON at position \d+.*$/i, '').replace(/\s*\(line \d+ column \d+\)/i, '').trim() || 'Invalid JSON';
}

export function checkJson(text: string): JsonCheck {
  const body = text.replace(/^\u{FEFF}/u, '');
  try {
    JSON.parse(body);
    return { ok: true };
  } catch (strictErr) {
    let err = strictErr;
    const stripped = stripJsonComments(body);
    try {
      JSON.parse(stripped);
      return { ok: true, lenient: true };
    } catch (lenientErr) {
      // with comments in the file, the real problem is what is left after removing them
      if (stripped !== body) err = lenientErr;
    }
    const off = errorOffset(err, body);
    const pos = off === null ? null : position(body, off);
    return { ok: false, message: cleanMessage(err), line: pos?.line, column: pos?.column };
  }
}

export function parseLooseJson(text: string): unknown {
  const body = text.replace(/^\u{FEFF}/u, '');
  try {
    return JSON.parse(body);
  } catch {
    return JSON.parse(stripJsonComments(body));
  }
}

/** Pretty-prints strict JSON with the indentation the file already uses (2 spaces by default). */
export function prettyJson(text: string): string {
  const body = text.replace(/^\u{FEFF}/u, '');
  const doc = JSON.parse(body);
  const m = /\n([ \t]+)["}\]]/.exec(body);
  const indent = m ? (m[1].startsWith('\t') ? '\t' : ' '.repeat(Math.min(8, m[1].length))) : 2;
  const eol = body.includes('\r\n') ? '\r\n' : '\n';
  let out = JSON.stringify(doc, null, indent);
  if (eol !== '\n') out = out.replace(/\n/g, eol);
  return (text.startsWith('\u{FEFF}') ? '\u{FEFF}' : '') + out + (/\r?\n$/.test(body) || !body.includes('\n') ? eol : '');
}

export function minifyJson(text: string): string {
  const body = text.replace(/^\u{FEFF}/u, '');
  return (text.startsWith('\u{FEFF}') ? '\u{FEFF}' : '') + JSON.stringify(JSON.parse(body));
}

// ---------------------------------------------------------------------------------------------
// Bedrock manifest

export type Semver = [number, number, number];

export interface BedrockManifestInfo {
  name: string;
  description: string;
  headerUuid?: string;
  moduleUuid?: string;
  version?: Semver;
  /** 'resources', 'data', 'script', 'skin_pack', ... of the first module */
  moduleType?: string;
}

function toSemver(v: unknown): Semver | undefined {
  if (Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every((x) => Number.isInteger(x) && x >= 0)) return [v[0], v[1], v[2]];
  if (typeof v === 'string') {
    const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
    if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  }
  return undefined;
}

export function compareSemver(a: Semver, b: Semver): number {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/** Reads name/uuids/version from manifest.json; `lang` resolves localized names like "pack.name". */
export function readBedrockManifest(text: string, lang?: Map<string, string>): BedrockManifestInfo | null {
  let doc: unknown;
  try {
    doc = parseLooseJson(text);
  } catch {
    return null;
  }
  if (!doc || typeof doc !== 'object') return null;
  const d = doc as { header?: Record<string, unknown>; modules?: unknown[] };
  const header = d.header && typeof d.header === 'object' ? d.header : {};
  const mod = Array.isArray(d.modules) ? (d.modules.find((m) => m && typeof m === 'object') as Record<string, unknown> | undefined) : undefined;
  const text2 = (v: unknown) => (typeof v === 'string' ? v : '');
  const localize = (s: string) => (lang && lang.has(s) ? lang.get(s)! : s);
  return {
    name: localize(text2(header.name)).trim(),
    description: localize(text2(header.description)).trim(),
    headerUuid: typeof header.uuid === 'string' ? header.uuid : undefined,
    moduleUuid: mod && typeof mod.uuid === 'string' ? mod.uuid : undefined,
    version: toSemver(header.version),
    moduleType: mod && typeof mod.type === 'string' ? mod.type : undefined,
  };
}

/**
 * Bumps the pack version in manifest.json (header and modules that share it) so Bedrock replaces
 * the installed copy. The uuids are kept. The result is at least one patch above `atLeast`.
 * Returns null when the manifest can't be read.
 */
export function bumpManifestVersion(text: string, atLeast?: Semver): { text: string; version: Semver } | null {
  let doc: Record<string, unknown>;
  try {
    doc = parseLooseJson(text) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!doc || typeof doc !== 'object' || !doc.header || typeof doc.header !== 'object') return null;
  const header = doc.header as Record<string, unknown>;
  const current = toSemver(header.version) ?? [1, 0, 0];
  let base = current;
  if (atLeast && compareSemver(atLeast, base) > 0) base = atLeast;
  const next: Semver = [base[0], base[1], base[2] + 1];
  const asString = typeof header.version === 'string';
  const write = (v: Semver) => (asString ? v.join('.') : [...v]);
  const oldKey = JSON.stringify(header.version);
  header.version = write(next);
  if (Array.isArray(doc.modules)) {
    for (const m of doc.modules) {
      if (m && typeof m === 'object' && JSON.stringify((m as Record<string, unknown>).version) === oldKey) (m as Record<string, unknown>).version = write(next);
    }
  }
  const indent = /\n(\t|[ ]+)"/.exec(text)?.[1] ?? '  ';
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  let out = JSON.stringify(doc, null, indent.startsWith('\t') ? '\t' : indent.length);
  if (eol !== '\n') out = out.replace(/\n/g, eol);
  return { text: out + eol, version: next };
}

/** Name from pack.mcmeta's description (text or text component). */
export function javaPackDescription(text: string): string {
  try {
    const doc = parseLooseJson(text) as { pack?: { description?: unknown } };
    const d = doc?.pack?.description;
    const flat = (x: unknown): string => {
      if (typeof x === 'string') return x;
      if (Array.isArray(x)) return x.map(flat).join('');
      if (x && typeof x === 'object') {
        const o = x as { text?: unknown; translate?: unknown; extra?: unknown };
        return `${typeof o.text === 'string' ? o.text : typeof o.translate === 'string' ? o.translate : ''}${o.extra ? flat(o.extra) : ''}`;
      }
      return '';
    };
    return flat(d).trim();
  } catch {
    return '';
  }
}
