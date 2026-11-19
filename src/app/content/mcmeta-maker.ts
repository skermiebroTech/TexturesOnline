// The pack.mcmeta maker on the pack format guide: pick one Java version or a range and get the
// file the Texture Pack Maker would export (buildPackMcmeta, the same rules), ready to copy.
// The markup is prerendered with the file for the newest release, so the static page already shows
// a working pack.mcmeta; ./mcmeta-wire.ts makes the controls work in the browser.

import { el, ic, type Child, type ElNode } from '../markup';
import { KNOWN_RELEASES, KNOWN_RELEASE_FORMATS, formatPackFormat } from '../../editions/java/packformats';
import { buildPackMcmeta } from '../../editions/java/packmeta';

/** Texts of the maker (English in the guide, translations in src/i18n/<lang>/guides.ts). */
export interface McmetaMakerText {
  title: string;
  lead: string;
  /** Label of the one version / range switch */
  worksOn: string;
  one: string;
  range: string;
  /** Label of the version list in "one version" mode */
  version: string;
  from: string;
  to: string;
  description: string;
  /** Description written into the file until one is typed */
  defaultDescription: string;
  copy: string;
  copied: string;
  /** When the clipboard is not available: the file's text is selected instead */
  copyFailed: string;
  download: string;
  /** "Pack format 97.1" */
  format(f: string): string;
  /** "Pack formats 15 – 97.1" (the range is filled in) */
  formats(range: string): string;
  /** Explanations under the file; text between backticks is shown as code */
  notes: {
    /** Only 1.21.9+ in the file */
    new: string;
    /** The range crosses 1.21.9: every field */
    all: string;
    /** pack_format + supported_formats */
    supported: string;
    /** A single pack_format */
    single: string;
    /** Added when versions before 1.20.2 in the range read a different pack_format */
    older: string;
  };
}

export type McmetaMode = 'one' | 'range';

export interface McmetaState {
  mode: McmetaMode;
  /** The version in "one" mode */
  version: string;
  from: string;
  to: string;
  description: string;
}

/** Every release with a known format, newest first. */
export const MCMETA_VERSIONS: readonly string[] = [...KNOWN_RELEASES].reverse();
export const MCMETA_LATEST = MCMETA_VERSIONS[0];
/** Where a new range starts: the oldest version the guide's range example uses. */
export const MCMETA_RANGE_FROM = '1.20.1';

/** First release that checks the pack format at all (1.6.1 – 1.8.7 load any number). */
const FIRST_CHECKED = KNOWN_RELEASES.indexOf('1.8.8');
/** Formats below this (1.20.1 and older) are compared exactly; 1.20.2 (18) reads supported_formats. */
const FIRST_SUPPORTED_FORMATS = 16;

export const initialMcmetaState = (text: McmetaMakerText): McmetaState => ({
  mode: 'one',
  version: MCMETA_LATEST,
  from: MCMETA_RANGE_FROM,
  to: MCMETA_LATEST,
  description: text.defaultDescription,
});

const fmtOf = (id: string) => KNOWN_RELEASE_FORMATS[id];

/** The pack.mcmeta for a choice, its formats and what the fields mean. */
export function mcmetaResult(state: McmetaState, text: McmetaMakerText): { json: string; summary: string; notes: string[] } {
  let [from, to] = state.mode === 'one' ? [state.version, state.version] : [state.from, state.to];
  if (KNOWN_RELEASES.indexOf(from) > KNOWN_RELEASES.indexOf(to)) [from, to] = [to, from];
  const lo = fmtOf(from);
  const hi = fmtOf(to);
  const description = state.description.trim() || text.defaultDescription;
  const json = buildPackMcmeta({ description, target: hi, range: { min: lo, max: hi } });
  const pack = (JSON.parse(json) as { pack: Record<string, unknown> }).pack;
  const notes: string[] = [];
  if (!('pack_format' in pack)) notes.push(text.notes.new);
  else if ('min_format' in pack) notes.push(text.notes.all);
  else if ('supported_formats' in pack) notes.push(text.notes.supported);
  else notes.push(text.notes.single);
  const main = typeof pack.pack_format === 'number' ? pack.pack_format : null;
  if (main !== null && from !== to) {
    const ids = KNOWN_RELEASES.slice(KNOWN_RELEASES.indexOf(from), KNOWN_RELEASES.indexOf(to) + 1);
    const warns = ids.some((id) => KNOWN_RELEASES.indexOf(id) >= FIRST_CHECKED && fmtOf(id).major < FIRST_SUPPORTED_FORMATS && fmtOf(id).major !== main);
    if (warns) notes.push(text.notes.older);
  }
  const summary = from === to || formatPackFormat(lo) === formatPackFormat(hi) ? text.format(formatPackFormat(hi)) : text.formats(`${formatPackFormat(lo)} – ${formatPackFormat(hi)}`);
  return { json: json.replace(/\n$/, ''), summary, notes };
}

/** A note with `code` spans. */
export function noteChildren(note: string): Child[] {
  return note.split('`').map((part, i) => (i % 2 ? el('code', null, part) : part));
}

const options = (selected: string): ElNode[] =>
  MCMETA_VERSIONS.map((v) => el('option', { value: v, selected: v === selected }, `${v} (${formatPackFormat(fmtOf(v))})`));

const selectField = (key: string, label: string, selected: string, hidden = false): ElNode =>
  el(
    'label',
    { class: 'field mcmeta-field', 'data-mcmeta-field': key, hidden },
    el('span', { class: 'field-label' }, label),
    el('span', { class: 'select' }, el('select', { class: 'select-input', 'data-mcmeta': key }, options(selected)), ic('chevron-down', { class: 'select-chevron' })),
  );

/** The maker as prerendered: controls, and the file for the newest release. */
export function mcmetaMaker(text: McmetaMakerText): ElNode {
  const state = initialMcmetaState(text);
  const result = mcmetaResult(state, text);
  return el(
    'section',
    { class: 'mcmeta-maker', 'data-mcmeta-maker': '', 'data-md': 'skip', 'aria-labelledby': 'mcmeta-maker-title' },
    el(
      'div',
      { class: 'mcmeta-maker-head' },
      el('span', { class: 'mcmeta-maker-icon' }, ic('file')),
      el('div', null, el('h2', { id: 'mcmeta-maker-title' }, text.title), el('p', { class: 'muted' }, text.lead)),
    ),
    el(
      'div',
      { class: 'mcmeta-maker-grid' },
      el(
        'div',
        { class: 'mcmeta-maker-form' },
        el(
          'div',
          { class: 'field' },
          el('span', { class: 'field-label', id: 'mcmeta-mode-label' }, text.worksOn),
          el(
            'div',
            { class: 'segmented', role: 'radiogroup', 'aria-labelledby': 'mcmeta-mode-label', 'data-mcmeta': 'mode' },
            (['one', 'range'] as const).map((m) =>
              el('button', { type: 'button', class: 'segmented-item', role: 'radio', 'aria-checked': String(m === state.mode), tabindex: m === state.mode ? '0' : '-1', 'data-value': m }, el('span', null, text[m])),
            ),
          ),
        ),
        selectField('version', text.version, state.version),
        el('div', { class: 'mcmeta-range', 'data-mcmeta-field': 'range', hidden: true }, selectField('from', text.from, state.from), selectField('to', text.to, state.to)),
        el(
          'label',
          { class: 'field mcmeta-field' },
          el('span', { class: 'field-label' }, text.description),
          el('input', { class: 'input', type: 'text', 'data-mcmeta': 'description', value: state.description, maxlength: '120', autocomplete: 'off', spellcheck: 'false' }),
        ),
      ),
      el(
        'div',
        { class: 'mcmeta-maker-out' },
        el(
          'div',
          { class: 'mcmeta-maker-bar' },
          el('span', { class: 'mcmeta-maker-file' }, el('code', null, 'pack.mcmeta'), el('span', { class: 'mcmeta-maker-format', 'data-mcmeta': 'summary', 'aria-live': 'polite' }, result.summary)),
          el(
            'span',
            { class: 'mcmeta-maker-actions' },
            el('button', { type: 'button', class: 'btn btn-secondary btn-sm', 'data-mcmeta': 'download' }, ic('download'), el('span', { class: 'btn-label' }, text.download)),
            el('button', { type: 'button', class: 'btn btn-primary btn-sm', 'data-mcmeta': 'copy' }, ic('copy'), el('span', { class: 'btn-label' }, text.copy)),
          ),
        ),
        el('pre', { class: 'guide-code mcmeta-maker-code' }, el('code', { 'data-mcmeta': 'json' }, result.json)),
        el('div', { class: 'mcmeta-maker-notes', 'data-mcmeta': 'notes' }, result.notes.map((n) => el('p', null, noteChildren(n)))),
      ),
    ),
  );
}
