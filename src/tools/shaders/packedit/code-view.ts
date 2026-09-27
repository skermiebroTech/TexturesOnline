// Files tab of the pack editor: a file tree with a filter and a plain-text editor with line
// numbers, find, per-file revert and JSON checking / pretty / minify. File contents are untrusted:
// they only ever go into a textarea's value or text nodes, and only raster images are shown as
// pictures.

import { button, iconButton, tooltip } from '../../../ui/components';
import { formatBytes, h } from '../../../ui/dom';
import { icon, type IconName } from '../../../ui/icons';
import { toast } from '../../../ui/toast';
import { extOf, isImagePath } from '../import/text';
import { checkJson, minifyJson, prettyJson } from './json-tools';
import type { PackWorkspace } from './workspace';

export interface CodeView {
  el: HTMLElement;
  open(path: string): void;
  current(): string | null;
  focusFind(): void;
  /** Repaints edited markers (after a revert from outside) */
  refresh(): void;
  /** Commits text typed in the last moments */
  flush(): void;
  destroy(): void;
}

interface TreeDir {
  name: string;
  path: string;
  dirs: Map<string, TreeDir>;
  files: string[];
}

const LINE_H = 24;

function fileIcon(path: string): IconName {
  if (isImagePath(path)) return 'image';
  const ext = extOf(path);
  if (/^(vsh|fsh|gsh|csh|glsl|tcs|tes|inc|h)$/.test(ext)) return 'code';
  if (ext === 'json' || ext === 'mcmeta') return 'script';
  if (ext === 'properties' || ext === 'lang' || ext === 'txt' || ext === 'md') return 'file-text';
  return 'file';
}

const isJsonPath = (p: string) => /\.(json|mcmeta)$/i.test(p);

export function createCodeView(opts: {
  ws: PackWorkspace;
  /** Called after the text of a file changed (debounce saving yourself) */
  onEdit: (path: string) => void;
  onRevert: (path: string) => void;
  initial?: string;
}): CodeView {
  const { ws } = opts;
  let current: string | null = null;
  let imgUrl: string | null = null;

  // ------------------------------------------------------------------ tree
  const root: TreeDir = { name: '', path: '', dirs: new Map(), files: [] };
  for (const p of ws.paths) {
    const parts = p.split('/');
    let d = root;
    for (let i = 0; i < parts.length - 1; i++) {
      let next = d.dirs.get(parts[i]);
      if (!next) {
        next = { name: parts[i], path: `${d.path}${parts[i]}/`, dirs: new Map(), files: [] };
        d.dirs.set(parts[i], next);
      }
      d = next;
    }
    d.files.push(p);
  }
  const fileButtons = new Map<string, HTMLButtonElement>();
  const dirEls = new Map<string, HTMLDetailsElement>();

  function fileRow(p: string, label = p.slice(p.lastIndexOf('/') + 1)): HTMLButtonElement {
    const b = h(
      'button',
      { type: 'button', class: 'pe-file', dataset: { path: p }, title: p },
      icon(fileIcon(p)),
      h('span', { class: 'pe-file-name truncate' }, label),
      h('span', { class: 'pe-file-dot', 'aria-hidden': 'true' }),
    );
    b.addEventListener('click', () => open(p));
    return b;
  }

  function dirEl(d: TreeDir, depth: number): HTMLElement {
    const kids = h('div', { class: 'pe-dir-body' });
    const sortedDirs = [...d.dirs.values()].sort((a, b) => a.name.localeCompare(b.name));
    for (const sub of sortedDirs) kids.appendChild(dirEl(sub, depth + 1));
    for (const f of d.files.sort((a, b) => a.localeCompare(b))) {
      const b = fileRow(f);
      fileButtons.set(f, b);
      kids.appendChild(b);
    }
    if (!d.path) return kids;
    const count = countFiles(d);
    const det = h(
      'details',
      { class: 'pe-dir', open: depth === 0 && (d.name === 'shaders' || root.dirs.size === 1), dataset: { path: d.path } },
      h('summary', null, icon('chevron-right', { class: 'pe-chev' }), icon('folder'), h('span', { class: 'pe-file-name truncate' }, d.name), h('span', { class: 'pe-dir-count' }, String(count))),
      kids,
    ) as HTMLDetailsElement;
    dirEls.set(d.path, det);
    return det;
  }

  function countFiles(d: TreeDir): number {
    let n = d.files.length;
    for (const s of d.dirs.values()) n += countFiles(s);
    return n;
  }

  const treeBody = h('div', { class: 'pe-files', role: 'tree' }, dirEl(root, -1));
  const flat = h('div', { class: 'pe-files is-flat', hidden: true });
  const noMatch = h('p', { class: 'pe-empty muted small', hidden: true });
  const filter = h('input', { class: 'input', type: 'search', placeholder: 'Filter files', 'aria-label': 'Filter files', autocomplete: 'off', spellcheck: false });
  filter.addEventListener('input', () => applyFilter());
  filter.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && filter.value) {
      e.stopPropagation();
      filter.value = '';
      applyFilter();
    }
  });

  function applyFilter(): void {
    const q = filter.value.trim().toLowerCase();
    treeBody.hidden = Boolean(q);
    flat.hidden = !q;
    if (!q) {
      noMatch.hidden = true;
      return;
    }
    const matches = ws.paths.filter((p) => p.toLowerCase().includes(q)).slice(0, 400);
    flat.replaceChildren(
      ...matches.map((p) => {
        const b = fileRow(p, p);
        paintRow(b, p);
        return b;
      }),
    );
    noMatch.hidden = matches.length > 0;
    noMatch.textContent = `No files match “${filter.value.trim()}”.`;
  }

  const editedOnly = h('span', { class: 'pe-tree-note small faint' });
  const treePanel = h(
    'section',
    { class: 'panel pe-tree-panel', 'aria-label': 'Pack files' },
    h('div', { class: 'panel-header' }, icon('files'), h('h2', null, 'Files'), h('span', { class: 'pe-count-plain faint small' }, `${ws.paths.length}`)),
    h('div', { class: 'pe-tree-tools' }, h('div', { class: 'input-with-icon' }, icon('search'), filter)),
    h('div', { class: 'pe-tree-scroll scroll' }, treeBody, flat, noMatch),
    h('div', { class: 'pe-tree-foot' }, editedOnly),
  );

  function paintRow(b: HTMLElement, p: string): void {
    b.classList.toggle('is-edited', ws.isEdited(p));
    b.classList.toggle('is-current', p === current);
    if (p === current) b.setAttribute('aria-current', 'true');
    else b.removeAttribute('aria-current');
  }

  function paintTree(): void {
    for (const [p, b] of fileButtons) paintRow(b, p);
    for (const b of flat.querySelectorAll<HTMLElement>('.pe-file')) paintRow(b, b.dataset.path!);
    for (const [dp, det] of dirEls) det.classList.toggle('has-edits', ws.editedPaths().some((e) => e.startsWith(dp)));
    const n = ws.editedPaths().length;
    editedOnly.textContent = n ? `${n} file${n === 1 ? '' : 's'} edited` : 'No files edited';
  }

  // ------------------------------------------------------------------ editor
  const pathEl = h('span', { class: 'pe-code-path truncate' });
  const metaEl = h('span', { class: 'pe-code-meta faint small' });
  const editedBadge = h('span', { class: 'badge tone-gold', hidden: true }, 'Edited');
  const jsonBadge = h('span', { class: 'badge', hidden: true });

  const findInput = h('input', { class: 'input pe-find-input', type: 'search', placeholder: 'Find', 'aria-label': 'Find in file', autocomplete: 'off', spellcheck: false });
  const findCount = h('span', { class: 'pe-find-count faint small', 'aria-live': 'polite' });
  const prevBtn = iconButton('chevron-up', 'Previous match (Shift+Enter)', () => step(-1), { size: 'sm' });
  const nextBtn = iconButton('chevron-down', 'Next match (Enter)', () => step(1), { size: 'sm' });
  const prettyBtn = button({ label: 'Pretty', icon: 'expand', size: 'sm', variant: 'ghost', onClick: () => reformat('pretty') });
  const minifyBtn = button({ label: 'Minify', icon: 'collapse', size: 'sm', variant: 'ghost', onClick: () => reformat('minify') });
  const revertBtn = button({ label: 'Revert file', icon: 'undo', size: 'sm', variant: 'ghost', onClick: () => revertCurrent() });
  tooltip(prettyBtn, 'Format the JSON with indentation');
  tooltip(minifyBtn, 'Put the JSON on one line');
  tooltip(revertBtn, 'Undo every edit to this file');

  const gutter = h('pre', { class: 'pe-gutter', 'aria-hidden': 'true' });
  const hl = h('div', { class: 'pe-line-hl', 'aria-hidden': 'true', hidden: true });
  const area = h('textarea', { class: 'pe-textarea', spellcheck: false, wrap: 'off', 'aria-label': 'File text', autocomplete: 'off' }) as HTMLTextAreaElement;
  area.setAttribute('autocapitalize', 'off');
  area.setAttribute('autocorrect', 'off');
  const textWrap = h('div', { class: 'pe-code-text' }, gutter, h('div', { class: 'pe-area-wrap' }, hl, area));
  const imageBox = h('div', { class: 'pe-code-image', hidden: true });
  const binaryBox = h('div', { class: 'pe-code-binary', hidden: true });
  const status = h('div', { class: 'pe-code-status small' });
  const placeholder = h('div', { class: 'pe-code-empty' }, icon('file-text', { size: 48 }), h('p', { class: 'muted' }, 'Pick a file on the left to view or edit it.'));

  const tools = h(
    'div',
    { class: 'pe-code-tools' },
    h('div', { class: 'pe-find' }, h('div', { class: 'input-with-icon' }, icon('search'), findInput), findCount, prevBtn, nextBtn),
    h('span', { class: 'grow' }),
    prettyBtn,
    minifyBtn,
    revertBtn,
  );
  const codePanel = h(
    'section',
    { class: 'panel pe-code-panel', 'aria-label': 'File editor' },
    h('div', { class: 'panel-header pe-code-head' }, icon('file-text'), h('div', { class: 'pe-code-title' }, pathEl, metaEl), editedBadge, jsonBadge),
    tools,
    h('div', { class: 'pe-code-body' }, placeholder, textWrap, imageBox, binaryBox),
    status,
  );

  let lineCount = 0;
  function paintGutter(force = false): void {
    const n = (area.value.match(/\r\n|\r|\n/g)?.length ?? 0) + 1;
    if (n === lineCount && !force) return;
    lineCount = n;
    let s = '';
    for (let i = 1; i <= n; i++) s += `${i}\n`;
    gutter.textContent = s;
  }

  function syncScroll(): void {
    gutter.scrollTop = area.scrollTop;
    hl.style.transform = `translateY(${-area.scrollTop}px)`;
  }
  area.addEventListener('scroll', syncScroll, { passive: true });

  function caretStatus(): void {
    if (!current || textWrap.hidden) return;
    const pos = area.selectionStart ?? 0;
    const before = area.value.slice(0, pos);
    const line = (before.match(/\r\n|\r|\n/g)?.length ?? 0) + 1;
    const col = pos - Math.max(before.lastIndexOf('\n'), before.lastIndexOf('\r')) ;
    const parts = [`Line ${line}, column ${col}`, `${lineCount} lines`, ws.encodingOf(current) === 'latin1' ? 'ISO-8859-1' : 'UTF-8'];
    status.replaceChildren(h('span', null, parts.join(' · ')), jsonStatusEl);
  }
  const jsonStatusEl = h('span', { class: 'pe-json-status' });
  area.addEventListener('keyup', caretStatus);
  area.addEventListener('click', caretStatus);
  // the find highlight is only for jumping; working in the text hides it
  area.addEventListener('mousedown', () => (hl.hidden = true));

  let jsonTimer: ReturnType<typeof setTimeout> | null = null;
  function paintJson(): void {
    if (!current || !isJsonPath(current)) {
      jsonBadge.hidden = true;
      prettyBtn.hidden = minifyBtn.hidden = true;
      jsonStatusEl.textContent = '';
      return;
    }
    prettyBtn.hidden = minifyBtn.hidden = false;
    const r = checkJson(area.value);
    jsonBadge.hidden = false;
    jsonBadge.className = `badge ${r.ok ? 'tone-green' : 'tone-red'}`;
    jsonBadge.textContent = r.ok ? (r.lenient ? 'JSON with comments' : 'Valid JSON') : 'JSON error';
    prettyBtn.disabled = minifyBtn.disabled = !r.ok || Boolean(r.lenient);
    jsonStatusEl.textContent = r.ok ? '' : `${r.message}${r.line ? ` (line ${r.line}, column ${r.column})` : ''}`;
    jsonStatusEl.classList.toggle('is-error', !r.ok);
  }

  function paintHeader(): void {
    if (!current) return;
    editedBadge.hidden = !ws.isEdited(current);
    revertBtn.hidden = !ws.isEdited(current);
  }

  let inputTimer: ReturnType<typeof setTimeout> | null = null;
  area.addEventListener('input', () => {
    hl.hidden = true;
    paintGutter();
    if (inputTimer) clearTimeout(inputTimer);
    // commit quickly, but not on every keystroke of a big file
    inputTimer = setTimeout(commit, area.value.length > 200_000 ? 400 : 120);
    if (jsonTimer) clearTimeout(jsonTimer);
    jsonTimer = setTimeout(paintJson, 400);
    if (findInput.value) {
      matchIndex = -1;
      recountFind();
    }
  });

  function commit(): void {
    inputTimer = null;
    if (!current || textWrap.hidden) return;
    const flip = ws.setText(current, area.value);
    paintHeader();
    if (flip) paintTree();
    opts.onEdit(current);
  }

  area.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const indent = /^\t/m.test(area.value) ? '\t' : '    ';
      const s = area.selectionStart;
      const en = area.selectionEnd;
      if (!e.shiftKey && s === en) {
        area.setRangeText(indent, s, en, 'end');
        area.dispatchEvent(new Event('input'));
      } else {
        // indent / outdent the selected lines
        const start = area.value.lastIndexOf('\n', s - 1) + 1;
        const block = area.value.slice(start, en);
        const next = e.shiftKey ? block.replace(/^(\t| {1,4})/gm, '') : block.replace(/^/gm, indent);
        area.setRangeText(next, start, en, 'select');
        area.dispatchEvent(new Event('input'));
      }
    } else if (e.key === 'Escape') {
      area.blur();
    }
  });

  // ------------------------------------------------------------------ find
  let matches: number[] = [];
  let matchIndex = -1;
  function recountFind(): void {
    const q = findInput.value;
    matches = [];
    if (q) {
      const text = area.value.toLowerCase();
      const needle = q.toLowerCase();
      let i = text.indexOf(needle);
      while (i >= 0 && matches.length < 10000) {
        matches.push(i);
        i = text.indexOf(needle, i + Math.max(1, needle.length));
      }
    }
    if (matchIndex >= matches.length) matchIndex = matches.length - 1;
    paintFind();
  }
  function paintFind(): void {
    const q = findInput.value;
    findCount.textContent = !q ? '' : matches.length ? `${matchIndex >= 0 ? matchIndex + 1 : 0} of ${matches.length}` : 'No matches';
    prevBtn.disabled = nextBtn.disabled = matches.length === 0;
    hl.hidden = matchIndex < 0 || !matches.length;
  }
  function step(dir: 1 | -1): void {
    if (!matches.length) return;
    matchIndex = (matchIndex + dir + matches.length) % matches.length;
    showMatch();
  }
  function showMatch(): void {
    const at = matches[matchIndex];
    if (at === undefined) return;
    const line = (area.value.slice(0, at).match(/\r\n|\r|\n/g)?.length ?? 0);
    area.setSelectionRange(at, at + findInput.value.length);
    const top = line * LINE_H;
    if (top < area.scrollTop + LINE_H || top > area.scrollTop + area.clientHeight - LINE_H * 2) area.scrollTop = Math.max(0, top - area.clientHeight / 3);
    hl.style.top = `${top + 8}px`;
    syncScroll();
    paintFind();
  }
  findInput.addEventListener('input', () => {
    matchIndex = -1;
    recountFind();
    if (matches.length) {
      // jump to the first match after the caret
      const from = area.selectionStart ?? 0;
      matchIndex = Math.max(0, matches.findIndex((m) => m >= from));
      showMatch();
    }
  });
  findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      step(e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape' && findInput.value) {
      e.stopPropagation();
      findInput.value = '';
      recountFind();
    }
  });

  // ------------------------------------------------------------------ open / revert / json tools
  function open(p: string): void {
    if (!ws.has(p)) return;
    if (inputTimer) {
      clearTimeout(inputTimer);
      commit();
    }
    current = p;
    if (imgUrl) {
      URL.revokeObjectURL(imgUrl);
      imgUrl = null;
    }
    placeholder.hidden = true;
    pathEl.textContent = p;
    pathEl.title = p;
    const size = formatBytes(ws.byteSize(p));
    const text = ws.isText(p);
    textWrap.hidden = !text;
    imageBox.hidden = true;
    binaryBox.hidden = true;
    tools.hidden = !text;
    matches = [];
    matchIndex = -1;
    if (text) {
      area.value = ws.text(p);
      area.scrollTop = 0;
      area.scrollLeft = 0;
      area.setSelectionRange(0, 0);
      paintGutter(true);
      syncScroll();
      metaEl.textContent = size;
      paintHeader();
      paintJson();
      caretStatus();
      if (findInput.value) recountFind();
      else paintFind();
    } else {
      editedBadge.hidden = true;
      jsonBadge.hidden = true;
      metaEl.textContent = size;
      status.replaceChildren(h('span', null, `${size} · binary file`));
      if (isImagePath(p)) {
        imgUrl = URL.createObjectURL(new Blob([ws.original[p] as Uint8Array<ArrayBuffer>], { type: `image/${extOf(p) === 'jpg' ? 'jpeg' : extOf(p)}` }));
        const img = h('img', { src: imgUrl, alt: p, class: 'pe-image', decoding: 'async' });
        const dims = h('span', { class: 'faint small' });
        img.addEventListener('load', () => (dims.textContent = `${img.naturalWidth} × ${img.naturalHeight} px`));
        img.addEventListener('error', () => img.replaceWith(h('p', { class: 'muted' }, "This image can't be shown.")));
        imageBox.replaceChildren(h('div', { class: 'pe-image-frame checker' }, img), dims);
        imageBox.hidden = false;
      } else {
        binaryBox.replaceChildren(icon('file', { size: 48 }), h('p', { class: 'muted' }, `Binary file (${size}). It is kept exactly as it is in the pack.`));
        binaryBox.hidden = false;
      }
    }
    paintTree();
    fileButtons.get(p)?.scrollIntoView({ block: 'nearest' });
    // reveal the file in the tree
    let dir = p.slice(0, p.lastIndexOf('/') + 1);
    while (dir) {
      const det = dirEls.get(dir);
      if (det) det.open = true;
      dir = dir.slice(0, dir.slice(0, -1).lastIndexOf('/') + 1);
    }
  }

  function revertCurrent(): void {
    if (!current || !ws.isEdited(current)) return;
    const p = current;
    const edited = ws.text(p);
    ws.revert(p);
    area.value = ws.text(p);
    paintGutter(true);
    paintHeader();
    paintJson();
    paintTree();
    opts.onRevert(p);
    toast(`Reverted ${p.slice(p.lastIndexOf('/') + 1)}`, {
      action: {
        label: 'Undo',
        onClick: () => {
          ws.setText(p, edited);
          if (current === p) {
            area.value = edited;
            paintGutter(true);
            paintHeader();
            paintJson();
          }
          paintTree();
          opts.onEdit(p);
        },
      },
    });
  }

  function reformat(mode: 'pretty' | 'minify'): void {
    if (!current) return;
    try {
      const next = mode === 'pretty' ? prettyJson(area.value) : minifyJson(area.value);
      if (next === area.value) return;
      area.select();
      // setRangeText keeps the browser's own undo history working in most browsers
      area.setRangeText(next, 0, area.value.length, 'start');
      area.dispatchEvent(new Event('input'));
    } catch {
      toast('Fix the JSON error first.', { tone: 'warn' });
    }
  }

  const el = h('div', { class: 'pe-files-layout' }, treePanel, codePanel);
  paintTree();
  textWrap.hidden = true;
  tools.hidden = true;
  if (opts.initial && ws.has(opts.initial)) open(opts.initial);

  return {
    el,
    open,
    current: () => current,
    focusFind() {
      if (current && !textWrap.hidden) {
        findInput.focus();
        findInput.select();
      } else filter.focus();
    },
    flush() {
      if (inputTimer) {
        clearTimeout(inputTimer);
        commit();
      }
    },
    refresh() {
      if (current && !textWrap.hidden && area.value !== ws.text(current)) {
        area.value = ws.text(current);
        paintGutter(true);
        paintJson();
      }
      paintHeader();
      paintTree();
    },
    destroy() {
      if (inputTimer) {
        clearTimeout(inputTimer);
        commit();
      }
      if (jsonTimer) clearTimeout(jsonTimer);
      if (imgUrl) URL.revokeObjectURL(imgUrl);
    },
  };
}
