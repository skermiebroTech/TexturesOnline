// Lossless text handling for pack files. Every file is kept as its original bytes; text files are
// decoded as UTF-8 when they are valid UTF-8 (a BOM is kept as U+FEFF) and as ISO-8859-1 byte by
// byte otherwise, so encoding the decoded text again gives back exactly the same bytes.

export type TextEncodingName = 'utf-8' | 'latin1';

export interface DecodedText {
  text: string;
  encoding: TextEncodingName;
}

const TEXT_EXT = new Set([
  'glsl', 'vsh', 'fsh', 'gsh', 'csh', 'tcs', 'tes', 'vert', 'frag', 'geom', 'comp', 'inc', 'h', 'hlsl', 'sc', 'fxh',
  'properties', 'lang', 'txt', 'md', 'json', 'mcmeta', 'jsonc', 'json5', 'cfg', 'ini', 'toml', 'xml', 'yml', 'yaml', 'csv',
  'mcfunction', 'material', 'placebo', 'gitignore', 'gitattributes', 'license', 'log', 'html', 'htm', 'css', 'js',
]);

const BINARY_EXT = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tga', 'dds', 'psd', 'ico', 'ogg', 'mp3', 'wav', 'fsb', 'zip', 'jar', 'mcpack',
  'mcaddon', 'mcworld', 'gz', 'bin', 'dat', 'nbt', 'class', 'exe', 'dll', 'so', 'dylib', 'ttf', 'otf', 'woff', 'woff2', 'spv',
  'hdr', 'exr', 'ktx', 'raw', 'pdf', 'svg',
]);

/** Images the Files tab can show as a picture (never SVG: it is treated as an opaque file). */
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']);

export function extOf(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function isImagePath(path: string): boolean {
  return IMAGE_EXT.has(extOf(path));
}

/** True for files that can be shown and edited as text. Unknown types are sniffed. */
export function isTextFile(path: string, bytes: Uint8Array): boolean {
  const ext = extOf(path);
  if (BINARY_EXT.has(ext)) return false;
  if (TEXT_EXT.has(ext)) return true;
  const n = Math.min(bytes.length, 4096);
  let control = 0;
  for (let i = 0; i < n; i++) {
    const b = bytes[i];
    if (b === 0) return false;
    if (b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d && b !== 0x0c) control++;
  }
  return control <= n * 0.02;
}

const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const encoder = new TextEncoder();

function latin1Decode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    out += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  }
  return out;
}

function latin1Encode(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    out[i] = c <= 0xff ? c : 0x3f; // '?' for characters the file's encoding cannot hold
  }
  return out;
}

export function decodeText(bytes: Uint8Array): DecodedText {
  try {
    return { text: utf8.decode(bytes), encoding: 'utf-8' };
  } catch {
    return { text: latin1Decode(bytes), encoding: 'latin1' };
  }
}

export function encodeText(text: string, encoding: TextEncodingName): Uint8Array {
  return encoding === 'latin1' ? latin1Encode(text) : encoder.encode(text);
}

/** Splits text into lines; each entry keeps its own line terminator ('\r\n', '\n', '\r' or ''). */
export function splitLinesKeepEnds(text: string): { line: string; end: string }[] {
  const out: { line: string; end: string }[] = [];
  const re = /\r\n|\n|\r/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    out.push({ line: text.slice(last, m.index), end: m[0] });
    last = m.index + m[0].length;
  }
  out.push({ line: text.slice(last), end: '' });
  return out;
}

/** Lines without terminators (same indexes as splitLinesKeepEnds). */
export function splitLines(text: string): string[] {
  return text.split(/\r\n|\n|\r/);
}

/** A copy that owns its buffer (views into a shared buffer would store the whole buffer). */
export function ownBytes(b: Uint8Array): Uint8Array {
  return b.byteOffset === 0 && b.byteLength === b.buffer.byteLength ? b : b.slice();
}
