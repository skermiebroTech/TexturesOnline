// Minecraft § formatting codes: a tiny renderer for pack names/descriptions (colours, bold, italic,
// underline, strikethrough; obfuscated text shows as a shimmer) and the code palette.

import { h } from '../../../ui/dom';

export const COLOR_CODES: Record<string, string> = {
  '0': '#000000',
  '1': '#0000aa',
  '2': '#00aa00',
  '3': '#00aaaa',
  '4': '#aa0000',
  '5': '#aa00aa',
  '6': '#ffaa00',
  '7': '#aaaaaa',
  '8': '#555555',
  '9': '#5555ff',
  a: '#55ff55',
  b: '#55ffff',
  c: '#ff5555',
  d: '#ff55ff',
  e: '#ffff55',
  f: '#ffffff',
};

const COLOR_NAMES: Record<string, string> = {
  '0': 'Black', '1': 'Dark blue', '2': 'Dark green', '3': 'Dark aqua', '4': 'Dark red', '5': 'Dark purple', '6': 'Gold', '7': 'Gray',
  '8': 'Dark gray', '9': 'Blue', a: 'Green', b: 'Aqua', c: 'Red', d: 'Light purple', e: 'Yellow', f: 'White',
};

export const FORMAT_CODES: { code: string; label: string; color?: string; glyph?: string }[] = [
  ...Object.keys(COLOR_CODES).map((code) => ({ code, label: COLOR_NAMES[code], color: COLOR_CODES[code] })),
  { code: 'l', label: 'Bold', glyph: 'B' },
  { code: 'o', label: 'Italic', glyph: 'I' },
  { code: 'n', label: 'Underline', glyph: 'U' },
  { code: 'm', label: 'Strikethrough', glyph: 'S' },
  { code: 'k', label: 'Obfuscated', glyph: '?' },
  { code: 'r', label: 'Reset', glyph: 'R' },
];

interface Style {
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  obf: boolean;
}

/** Shadow colour the game draws under text: the colour at 1/4 brightness. */
function shadowOf(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) >> 2;
  const g = ((n >> 8) & 255) >> 2;
  const b = (n & 255) >> 2;
  return `rgb(${r}, ${g}, ${b})`;
}

/** Renders text with § codes into styled spans (line breaks kept). */
export function formattedText(text: string, baseColor: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const base: Style = { color: baseColor, bold: false, italic: false, underline: false, strike: false, obf: false };
  let st: Style = { ...base };
  let buf = '';
  const flush = () => {
    if (!buf) return;
    const deco = [st.underline && 'underline', st.strike && 'line-through'].filter(Boolean).join(' ');
    frag.appendChild(
      h(
        'span',
        {
          class: ['mc-seg', st.obf && 'mc-obf'],
          style: {
            color: st.color,
            textShadow: `0.125em 0.125em 0 ${shadowOf(st.color)}`,
            fontWeight: st.bold ? '700' : undefined,
            fontStyle: st.italic ? 'italic' : undefined,
            textDecoration: deco || undefined,
          },
        },
        buf,
      ),
    );
    buf = '';
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '§' && i + 1 < text.length) {
      const code = text[i + 1].toLowerCase();
      i++;
      flush();
      if (COLOR_CODES[code]) st = { ...base, color: COLOR_CODES[code] };
      else if (code === 'l') st = { ...st, bold: true };
      else if (code === 'o') st = { ...st, italic: true };
      else if (code === 'n') st = { ...st, underline: true };
      else if (code === 'm') st = { ...st, strike: true };
      else if (code === 'k') st = { ...st, obf: true };
      else if (code === 'r') st = { ...base };
      continue;
    }
    if (ch === '\n') {
      flush();
      frag.appendChild(document.createElement('br'));
      continue;
    }
    buf += ch;
  }
  flush();
  return frag;
}

/** Text without § codes. */
export function plainText(text: string): string {
  return text.replace(/§./g, '');
}
