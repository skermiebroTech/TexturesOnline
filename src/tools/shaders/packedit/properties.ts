// java.util.Properties parsing (shaders.properties and .lang files are read that way by Iris),
// Minecraft § formatting codes and readable fallback names. Pure.

/**
 * Parses Java .properties text: '#'/'!' comment lines, backslash line continuations, keys ending
 * at the first unescaped '=', ':' or whitespace, and \t \n \r \f \uXXXX escapes. Later duplicates
 * replace earlier values but keep the first position (like Iris' order-keeping Properties).
 */
export function parseProperties(text: string): Map<string, string> {
  const out = new Map<string, string>();
  const natural = text.split(/\r\n|\n|\r/);
  let i = 0;
  const isWs = (c: string) => c === ' ' || c === '\t' || c === '\f';
  while (i < natural.length) {
    let line = natural[i++];
    let s = 0;
    while (s < line.length && isWs(line[s])) s++;
    line = line.slice(s);
    if (!line || line[0] === '#' || line[0] === '!') continue;
    // continuation: an odd number of trailing backslashes
    let logical = '';
    for (;;) {
      let bs = 0;
      for (let k = line.length - 1; k >= 0 && line[k] === '\\'; k--) bs++;
      if (bs % 2 === 1 && i < natural.length) {
        logical += line.slice(0, -1);
        let next = natural[i++];
        let t = 0;
        while (t < next.length && isWs(next[t])) t++;
        next = next.slice(t);
        line = next;
        continue;
      }
      logical += bs % 2 === 1 ? line.slice(0, -1) : line;
      break;
    }
    let k = 0;
    let key = '';
    while (k < logical.length) {
      const c = logical[k];
      if (c === '\\') {
        key += logical.slice(k, k + 2);
        k += 2;
        continue;
      }
      if (c === '=' || c === ':' || isWs(c)) break;
      key += c;
      k++;
    }
    while (k < logical.length && isWs(logical[k])) k++;
    if (k < logical.length && (logical[k] === '=' || logical[k] === ':')) {
      k++;
      while (k < logical.length && isWs(logical[k])) k++;
    }
    out.set(unescape(key), unescape(logical.slice(k)));
  }
  return out;
}

function unescape(s: string): string {
  if (!s.includes('\\')) return s;
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== '\\' || i === s.length - 1) {
      out += c;
      continue;
    }
    const n = s[++i];
    if (n === 't') out += '\t';
    else if (n === 'n') out += '\n';
    else if (n === 'r') out += '\r';
    else if (n === 'f') out += '\f';
    else if (n === 'u' && /^[0-9a-fA-F]{4}$/.test(s.slice(i + 1, i + 5))) {
      out += String.fromCharCode(parseInt(s.slice(i + 1, i + 5), 16));
      i += 4;
    } else out += n;
  }
  return out;
}

/** Whitespace separated list (shaders.properties values like screen=, sliders=, profile.X=). */
export function wordList(value: string | undefined): string[] {
  return (value ?? '').split(/\s+/).filter(Boolean);
}

// ---------------------------------------------------------------------------------------------
// Minecraft formatting codes (§a green, §l bold, §r reset, ...), used by pack .lang files.

export interface FormattedRun {
  text: string;
  /** '0'..'f' colour code */
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
}

export function formatRuns(s: string): FormattedRun[] {
  const out: FormattedRun[] = [];
  let cur: FormattedRun = { text: '' };
  const push = () => {
    if (cur.text) out.push(cur);
  };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '§' && i + 1 < s.length) {
      const code = s[++i].toLowerCase();
      push();
      const next: FormattedRun = { ...cur, text: '' };
      if (/[0-9a-f]/.test(code)) {
        // a colour code also resets the styles
        cur = { text: '', color: code };
        continue;
      }
      if (code === 'r') cur = { text: '' };
      else if (code === 'l') cur = { ...next, bold: true };
      else if (code === 'o') cur = { ...next, italic: true };
      else if (code === 'n') cur = { ...next, underline: true };
      else if (code === 'm') cur = { ...next, strike: true };
      else cur = next; // §k (obfuscated) and unknown codes are dropped
      continue;
    }
    cur.text += c;
  }
  push();
  return out;
}

export function stripFormatting(s: string): string {
  return s.replace(/§./g, '').replace(/§$/, '');
}

// ---------------------------------------------------------------------------------------------
// Readable names for options and screens without a translation.

const ACRONYMS = new Set([
  'AO', 'SSAO', 'HBAO', 'GTAO', 'TAA', 'FXAA', 'SMAA', 'DOF', 'HDR', 'PBR', 'RGB', 'RGBA', 'UI', 'FPS', 'LOD', 'SSR', 'SSS', 'GI', 'MC', 'ID',
  'IDS', 'FOV', 'POM', 'RP', 'DH', 'LUT', 'UV', 'VL', 'MCBL', 'CGT', 'BRDF', 'IPBR', 'SSGI', 'RTAO', 'RT', 'PT', 'OF', 'VR', 'CPU', 'GPU',
  'LAB', 'SEUS', 'BSL', 'TM', 'MSAA',
]);

/** 'SHADOW_MAP_RES' -> 'Shadow Map Res', 'shadowMapResolution' -> 'Shadow Map Resolution'. */
export function prettifyName(name: string): string {
  const words = name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])([0-9])/g, '$1 $2')
    .split(/[_\s.-]+/)
    .filter(Boolean);
  if (!words.length) return name;
  return words
    .map((w) => {
      const up = w.toUpperCase();
      if (ACRONYMS.has(up)) return up;
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}
