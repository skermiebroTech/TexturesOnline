const BEDROCK_EXT = /\.(mcpack|mcaddon|mcworld|mctemplate)$/i;

/** Makes a string safe to use as a file name on every OS (keeps the extension). */
export function sanitizeFilename(name: string, fallback = 'download'): string {
  let s = (name || '')
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '');
  if (/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(s)) s = '_' + s;
  if (!s) s = fallback;
  if (s.length > 180) {
    const dot = s.lastIndexOf('.');
    const ext = dot > 0 && s.length - dot <= 12 ? s.slice(dot) : '';
    s = s.slice(0, 180 - ext.length) + ext;
  }
  return s;
}

/** Triggers a browser download of blob under filename. */
export function saveBlob(blob: Blob, filename: string): void {
  const name = sanitizeFilename(filename);
  // Octet-stream keeps OSes from renaming .mcpack to .zip and lets Minecraft claim the file.
  const data = BEDROCK_EXT.test(name) && blob.type !== 'application/octet-stream'
    ? new Blob([blob], { type: 'application/octet-stream' })
    : blob;
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  try {
    a.click();
  } finally {
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 60_000);
  }
}

export function saveText(text: string, filename: string, type = 'text/plain'): void {
  saveBlob(new Blob([text], { type: `${type};charset=utf-8` }), filename);
}
