// Makes the prerendered pack.mcmeta maker (./mcmeta-maker.ts) work: the version switch and lists,
// the description, Copy and Download. Loaded by the guide page that has the maker.

import { initialMcmetaState, mcmetaResult, noteChildren, type McmetaMakerText, type McmetaMode, type McmetaState } from './mcmeta-maker';
import { toDomAll } from '../markup-dom';

/** Wires the maker inside root; returns a cleanup function. */
export function wireMcmetaMaker(root: HTMLElement, text: McmetaMakerText): () => void {
  const box = root.querySelector<HTMLElement>('[data-mcmeta-maker]');
  if (!box) return () => undefined;
  const q = <T extends HTMLElement>(key: string) => box.querySelector<T>(`[data-mcmeta="${key}"]`)!;
  const field = (key: string) => box.querySelector<HTMLElement>(`[data-mcmeta-field="${key}"]`)!;
  const modeButtons = Array.from(q('mode').querySelectorAll<HTMLButtonElement>('[role="radio"]'));
  const version = q<HTMLSelectElement>('version');
  const from = q<HTMLSelectElement>('from');
  const to = q<HTMLSelectElement>('to');
  const description = q<HTMLInputElement>('description');
  const json = q('json');
  const summary = q('summary');
  const notes = q('notes');
  const copyBtn = q<HTMLButtonElement>('copy');
  const downloadBtn = q<HTMLButtonElement>('download');
  const copyLabel = copyBtn.querySelector('.btn-label')!;

  const state: McmetaState = { ...initialMcmetaState(text), version: version.value, from: from.value, to: to.value, description: description.value };
  let file = '';
  let copiedTimer = 0;

  const paragraph = (note: string): HTMLParagraphElement => {
    const p = document.createElement('p');
    p.append(...toDomAll(noteChildren(note)));
    return p;
  };

  const render = () => {
    const r = mcmetaResult(state, text);
    file = `${r.json}\n`;
    json.textContent = r.json;
    summary.textContent = r.summary;
    notes.replaceChildren(...r.notes.map(paragraph));
    modeButtons.forEach((b) => {
      const on = b.dataset.value === state.mode;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    field('version').hidden = state.mode !== 'one';
    field('range').hidden = state.mode !== 'range';
  };
  const setMode = (mode: McmetaMode, focus = false) => {
    if (mode === state.mode) return;
    state.mode = mode;
    // A range ends at the version picked so far.
    if (mode === 'range' && state.version !== state.to) {
      state.to = state.version;
      to.value = state.version;
    }
    render();
    if (focus) modeButtons.find((b) => b.dataset.value === mode)?.focus();
  };
  const onModeClick = (e: Event) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('[role="radio"]');
    if (b) setMode(b.dataset.value as McmetaMode);
  };
  const onModeKey = (e: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    setMode(state.mode === 'one' ? 'range' : 'one', true);
  };
  const onChange = () => {
    state.version = version.value;
    state.from = from.value;
    state.to = to.value;
    state.description = description.value;
    render();
  };

  const selectCode = () => {
    const range = document.createRange();
    range.selectNodeContents(json);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };
  const onCopy = async () => {
    window.clearTimeout(copiedTimer);
    try {
      await navigator.clipboard.writeText(file);
      copyLabel.textContent = text.copied;
      copyBtn.dataset.state = 'copied';
    } catch {
      selectCode();
      copyLabel.textContent = text.copy;
      copyBtn.dataset.state = 'failed';
      copyBtn.title = text.copyFailed;
    }
    copiedTimer = window.setTimeout(() => {
      copyLabel.textContent = text.copy;
      delete copyBtn.dataset.state;
    }, 2000);
  };
  const onDownload = () => {
    const url = URL.createObjectURL(new Blob([file], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'pack.mcmeta' });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const group = q('mode');
  group.addEventListener('click', onModeClick);
  group.addEventListener('keydown', onModeKey);
  for (const el of [version, from, to]) el.addEventListener('change', onChange);
  description.addEventListener('input', onChange);
  copyBtn.addEventListener('click', onCopy);
  downloadBtn.addEventListener('click', onDownload);
  box.dataset.ready = '';
  render();
  return () => {
    window.clearTimeout(copiedTimer);
    group.removeEventListener('click', onModeClick);
    group.removeEventListener('keydown', onModeKey);
    for (const el of [version, from, to]) el.removeEventListener('change', onChange);
    description.removeEventListener('input', onChange);
    copyBtn.removeEventListener('click', onCopy);
    downloadBtn.removeEventListener('click', onDownload);
  };
}
