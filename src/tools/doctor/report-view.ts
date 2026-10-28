// Pack Doctor's report: reads the dropped pack, gets what the checks need (the converter's rename
// data, the game's file list), checks, and shows every problem with its fix; then Fix all / Fix,
// the before-and-after summary and the download. Loaded by view.ts when a pack is dropped.

import type { Edition } from '../../core/types';
import type { Locale } from '../../i18n/locales';
import { href as routeHref } from '../../core/router';
import { h, formatBytes } from '../../ui/dom';
import { icon, type IconName } from '../../ui/icons';
import { badge, button, progressBar, setButtonBusy, spinner } from '../../ui/components';
import { toast } from '../../ui/toast';
import { saveBlob } from '../../core/download';
import { friendlyError, isAbortError } from '../../core/net';
import { getJavaPackFormat } from '../../editions/java/packmeta';
import { KNOWN_RELEASE_FORMATS } from '../../editions/java/packformats';
import { loadConvertMaps } from '../convert/data';
import { targetText } from '../convert/target';
import { kit } from '../../ui/i18n/kit';
import { fmt, num } from '../../i18n/editor-text';
import { r } from './i18n/report';
import { openArchive, openFolder } from './archive';
import { findPacks, pickPack } from './layout';
import { bedrockVanilla, javaVanilla } from './vanilla';
import { buildFixed, fixAll, fixOne, looksGood, outName, startSession, summary, type CheckContext, type Session } from './doctor';
import { SEVERITIES, type Change, type Checked, type DoctorTarget, type Issue, type IssueCode, type IssueLink, type PackArchive, type Severity } from './types';

export type Source = { kind: 'file'; file: File } | { kind: 'folder'; name: string; list: { path: string; file: Blob }[] };

export interface PackInfo {
  name: string;
  fileName: string;
  description: string;
  edition: Edition | null;
  packVersion: string | null;
  icon: Blob | null;
  files: number;
  textures: number;
}

export interface ReportHandle {
  check(source: Source): Promise<void>;
  /** Check the same pack again for another game (fixes are dropped) */
  recheck(): Promise<void>;
  hasPack(): boolean;
  hasFixes(): boolean;
  clear(): void;
  destroy(): void;
}

interface Options {
  root: HTMLElement;
  locale: Locale;
  target(detected: Edition | null): DoctorTarget;
  onPack(info: PackInfo | null): void;
  onBusy(on: boolean): void;
  onAgain(): void;
}

const UUIDS_KEY = 'doctor.uuids';
const LIST_LIMIT = 200;

/** Which parameter picks a problem's text when it has several (see i18n/report.ts). */
const VARIANT: Partial<Record<IssueCode, (i: Issue) => string>> = {
  'zip-damaged': (i) => String(i.params.reason),
  'zip-method': (i) => String(i.params.reason),
  'nested-folder': (i) => i.affects.edition,
  'nested-archive': (i) => i.affects.edition,
  'other-bedrock-pack': (i) => String(i.params.type),
  'wrong-edition': (i) => String(i.params.pack),
  'mcmeta-strict': (i) => String(i.params.reason),
  'format-mismatch': (i) => String(i.params.direction),
  'manifest-header': (i) => String(i.params.reason),
  'manifest-uuid': (i) => String(i.params.reason),
  'manifest-engine': (i) => String(i.params.reason),
  'bedrock-case': (i) => String(i.params.what),
  'wrong-image-type': (i) => i.affects.edition,
};

const LINKS: Record<IssueLink, { to: string; label: () => string; icon: IconName }> = {
  converter: { to: '/texture-pack-converter', label: () => r.links.converter, icon: 'repeat' },
  install: { to: '/guides/install-resource-packs', label: () => r.links.install, icon: 'download' },
  'shaders-help': { to: '/help#iris', label: () => r.links.shadersHelp, icon: 'sparkles' },
  formats: { to: '/guides/minecraft-pack-format-versions', label: () => r.links.formats, icon: 'bulletlist' },
  textures: { to: '/textures', label: () => r.links.textures, icon: 'image' },
  sounds: { to: '/help#sounds', label: () => r.links.sounds, icon: 'music' },
  skins: { to: '/skin-pack-maker', label: () => r.links.skins, icon: 'package' },
  'not-working': { to: '/guides/texture-pack-not-working', label: () => r.links.notWorking, icon: 'warning-diamond' },
  'bedrock-packs': { to: '/help#bedrock-packs', label: () => r.links.bedrockPacks, icon: 'gamepad' },
};

const SEVERITY_ICON: Record<Severity, IconName> = { error: 'square-alert', broken: 'warning-diamond', warning: 'circle-info', info: 'info' };

type IssueText = { title: string | Record<string, string>; text: string | Record<string, string>; fix?: string | Record<string, string>; steps?: string | Record<string, string> };

function pick(v: string | Record<string, string> | undefined, variant: string | undefined): string | undefined {
  if (v === undefined || typeof v === 'string') return v;
  return (variant && v[variant]) || v.other || Object.values(v)[0];
}

function knownUuids(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(UUIDS_KEY) || '{}') as Record<string, string>;
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function rememberUuid(uuid: string, name: string): void {
  try {
    const all = knownUuids();
    delete all[uuid];
    all[uuid] = name;
    const keys = Object.keys(all);
    for (const k of keys.slice(0, Math.max(0, keys.length - 60))) delete all[k];
    localStorage.setItem(UUIDS_KEY, JSON.stringify(all));
  } catch {
    /* private window */
  }
}

function editionLabel(e: Edition): string {
  return e === 'java' ? kit.edition.java : kit.edition.bedrock;
}

export function createReport(opts: Options): ReportHandle {
  const root = opts.root;
  const titleId = root.getAttribute('aria-labelledby') ?? 'dr-res';
  let alive = true;
  let archive: PackArchive | null = null;
  let session: Session | null = null;
  let target: DoctorTarget | null = null;
  let controller: AbortController | null = null;
  let running = false;

  function clear() {
    controller?.abort();
    archive = null;
    session = null;
    root.hidden = true;
    root.replaceChildren();
    opts.onPack(null);
  }

  /** Progress card while reading, getting game files and checking. */
  function progress(title: string) {
    const steps = [
      { id: 'read', label: r.progress.reading },
      { id: 'game', label: fmt(r.progress.gameFiles, { target: target ? targetText(target) : '…' }) },
      { id: 'check', label: r.progress.checking },
    ];
    const els = steps.map((s) => h('li', { class: 'cv-prog-step', dataset: { state: 'todo', id: s.id } }, h('span', { class: 'cv-prog-dot' }), h('span', { class: 'dr-prog-label' }, s.label)));
    const bar = progressBar({ label: r.progress.reading });
    bar.set({ label: r.progress.reading, fraction: null });
    root.hidden = false;
    root.replaceChildren(
      h('div', { class: 'cv-res-head' }, h('span', { class: 'cv-res-icon is-busy' }, spinner(28)), h('div', { class: 'cv-res-titles' }, h('h2', { id: titleId }, title), h('p', { class: 'muted' }, r.progress.inBrowser))),
      h('div', { class: 'cv-progress' }, h('ol', { class: 'cv-prog-steps dr-prog-steps' }, els), bar),
      h('div', { class: 'cv-actions' }, button({ label: kit.cancel, variant: 'secondary', onClick: () => controller?.abort() })),
    );
    return {
      bar,
      step(id: string, label?: string) {
        const i = steps.findIndex((s) => s.id === id);
        els.forEach((el, j) => {
          el.dataset.state = j < i ? 'done' : j === i ? 'active' : 'todo';
          if (j === i && label) (el.querySelector('.dr-prog-label') as HTMLElement).textContent = label;
        });
      },
    };
  }

  async function context(t: DoctorTarget, p: ReturnType<typeof progress>, signal: AbortSignal): Promise<CheckContext> {
    p.step('game', fmt(r.progress.gameFiles, { target: targetText(t) }));
    p.bar.set({ label: fmt(r.progress.gameFiles, { target: targetText(t) }), fraction: null });
    if (t.edition === 'java') {
      const [maps, vanilla, format] = await Promise.all([
        loadConvertMaps().catch(() => null),
        javaVanilla(t.version),
        KNOWN_RELEASE_FORMATS[t.version] ? Promise.resolve(KNOWN_RELEASE_FORMATS[t.version]) : getJavaPackFormat(t.version).catch(() => null),
      ]);
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      return { target: t, renames: maps?.renames ?? null, javaVanilla: vanilla, targetFormat: format, knownUuids: knownUuids(), signal };
    }
    const vanilla = await bedrockVanilla();
    return { target: t, bedrockVanilla: vanilla, knownUuids: knownUuids(), signal };
  }

  async function run(source: Source | null) {
    controller?.abort();
    const c = new AbortController();
    controller = c;
    running = true;
    opts.onBusy(true);
    try {
      let p = progress(r.progress.title);
      if (source) {
        p.step('read');
        const label = r.progress.reading;
        const next = source.kind === 'file' ? await openArchive(source.file, source.file.name, { signal: c.signal, onProgress: (x) => p.bar.set({ ...x, label }), label }) : await openFolder(source.list, source.name, { signal: c.signal, onProgress: (x) => p.bar.set({ ...x, label }), label });
        if (c.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        archive = next;
      }
      if (!archive) return;
      const found = pickPack(findPacks(archive), archive.fileName);
      const detected: Edition | null = found?.kind === 'java' ? 'java' : found?.kind === 'bedrock' ? 'bedrock' : null;
      target = opts.target(detected);
      p = progress(r.progress.title);
      p.step('read');
      const ctx = await context(target, p, c.signal);
      p.step('check');
      p.bar.set({ label: r.progress.checking, fraction: null });
      const s = await startSession(archive, ctx);
      if (!alive || controller !== c) return;
      session = s;
      const d = s.before;
      if (d.edition === 'bedrock' && d.uuid && d.kind === 'bedrock') rememberUuid(d.uuid, d.name);
      opts.onPack({
        name: d.name,
        fileName: archive.fileName,
        description: d.description,
        edition: d.edition,
        packVersion: d.edition === 'java' ? d.packVersion : null,
        icon: d.icon ? new Blob([d.icon as Uint8Array<ArrayBuffer>], { type: 'image/png' }) : null,
        files: d.stats.files || archive.files.size,
        textures: d.stats.textures,
      });
      render();
    } catch (err) {
      if (!alive) return;
      if (isAbortError(err) || c.signal.aborted) {
        if (controller === c) {
          root.hidden = true;
          root.replaceChildren();
          toast(r.progress.cancelled);
          if (!session) opts.onPack(null);
          else render();
        }
        return;
      }
      console.error(err);
      showError(err);
    } finally {
      if (controller === c) {
        running = false;
        controller = null;
      }
      opts.onBusy(false);
    }
  }

  function showError(err: unknown) {
    root.hidden = false;
    root.replaceChildren(
      h(
        'div',
        { class: 'cv-res-head' },
        h('span', { class: 'cv-res-icon is-error' }, icon('warning-diamond', { size: 32 })),
        h('div', { class: 'cv-res-titles' }, h('h2', { id: titleId }, r.error.title), h('p', null, friendlyError(err)), h('p', { class: 'faint small' }, r.error.text)),
      ),
      h('div', { class: 'cv-actions' }, button({ label: kit.tryAgain, icon: 'reload', variant: 'primary', onClick: () => void run(null) }), button({ label: r.actions.again, icon: 'folder', variant: 'ghost', onClick: () => opts.onAgain() })),
    );
  }

  // ---------------------------------------------------------------- the report

  async function act(btn: HTMLButtonElement, fn: () => Promise<Session>) {
    if (!session || running) return;
    running = true;
    opts.onBusy(true);
    root.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = true));
    setButtonBusy(btn, true);
    try {
      session = await fn();
      if (!alive) return;
      render(true);
    } catch (err) {
      console.error(err);
      toast(fmt(r.actions.failed, { message: friendlyError(err) }), { tone: 'error' });
      render();
    } finally {
      running = false;
      opts.onBusy(false);
    }
  }

  function render(afterFix = false) {
    if (!session || !target) return;
    const s = session;
    const d = s.now;
    const counts = summary(d);
    const good = looksGood(d.issues);
    const fixed = !!s.files;
    const safe = d.issues.filter((i) => i.fix?.safe);
    const problems = counts.error + counts.broken + counts.warning;
    const tone = good ? 'is-ok' : counts.error ? 'is-error' : 'is-warn';
    const head = h(
      'div',
      { class: 'cv-res-head' },
      h('span', { class: ['cv-res-icon', tone] }, icon(good ? 'check' : counts.error ? 'square-alert' : 'warning-diamond', { size: 32 })),
      h(
        'div',
        { class: 'cv-res-titles' },
        h('span', { class: 'eyebrow' }, fmt(r.head.checkedFor, { target: targetText(target) })),
        h('h2', { id: titleId, class: 'dr-headline' }, fixed ? r.head.fixedTitle : good ? r.head.good : fmt(r.head.problems, { count: problems })),
        h('p', { class: 'muted' }, fixed ? (good ? r.head.fixedGood : fmt(r.head.fixedLeft, { count: problems })) : good ? r.head.goodText : r.actions.fixAllHint),
      ),
    );
    const chips = h(
      'div',
      { class: 'dr-chips', role: 'list' },
      (['error', 'broken', 'warning'] as Severity[]).map((sev) => h('span', { class: ['dr-chip', `sev-${sev}`, counts[sev] ? null : 'is-zero'], role: 'listitem' }, h('strong', null, num(counts[sev])), h('span', null, r.severity[sev]))),
    );

    // Actions
    const actions = h('div', { class: 'cv-actions dr-actions' });
    if (safe.length) {
      const all = button({ label: fmt(r.actions.fixAll, { count: safe.length }), icon: 'wand', variant: 'primary', size: 'lg', class: 'dr-fix-all' });
      all.addEventListener('click', () => void act(all, () => fixAll(s)));
      actions.append(all);
    }
    const dlBox = h('div', { class: 'cv-install dr-install', hidden: true });
    if (fixed) {
      const dl = button({ label: fmt(r.actions.download, { file: outName(s) }), icon: 'download', variant: safe.length ? 'secondary' : 'primary', size: 'lg', class: 'dr-download' });
      dl.addEventListener('click', () => void download(dl, dlBox));
      actions.append(dl);
      const undo = button({ label: r.actions.undo, icon: 'undo', variant: 'ghost', class: 'dr-undo' });
      undo.addEventListener('click', () => {
        if (!session) return;
        session = { ...session, now: session.before, files: null, changes: [], applied: 0 };
        render();
      });
      actions.append(undo);
    }
    if (good && !fixed) {
      const L = LINKS['not-working'];
      actions.append(h('a', { class: 'btn btn-secondary dr-link', href: routeHref(L.to) }, icon(L.icon), h('span', { class: 'btn-label' }, L.label())));
    }
    actions.append(button({ label: r.actions.again, icon: 'folder', variant: 'ghost', class: 'cv-again dr-again', onClick: () => opts.onAgain() }));

    // A healthy pack needs no row of zeros.
    const parts: Node[] = good && !fixed ? [head] : [head, chips];
    if (fixed) parts.push(beforeAfter(s));
    parts.push(actions, dlBox);
    if (!fixed && !safe.length && problems) parts.push(h('p', { class: 'faint small dr-nothing' }, r.actions.nothingToFix));
    for (const sev of SEVERITIES) {
      const list = d.issues.filter((i) => i.severity === sev);
      if (!list.length) continue;
      parts.push(
        h(
          'section',
          { class: ['dr-group', `sev-${sev}`], 'aria-label': r.groups[sev] },
          h('h3', { class: 'dr-group-title' }, icon(SEVERITY_ICON[sev], { size: 16 }), h('span', null, r.groups[sev]), h('span', { class: 'cv-count' }, num(list.length))),
          h('div', { class: 'dr-issues' }, list.map((i) => issueCard(i, s))),
        ),
      );
    }
    parts.push(checkedList(d.checked, good, d.vanillaChecked, d.edition));
    root.hidden = false;
    root.replaceChildren(...parts);
    if (afterFix) root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function beforeAfter(s: Session): HTMLElement {
    const b = summary(s.before);
    const a = summary(s.now);
    const cell = (n: number, sev: Severity) => h('span', { class: ['dr-ba-n', `sev-${sev}`, n ? null : 'is-zero'] }, num(n));
    const rows = (['error', 'broken', 'warning'] as Severity[]).map((sev) =>
      h(
        'div',
        { class: ['dr-ba-row', `sev-${sev}`], role: 'row' },
        h('span', { class: 'dr-ba-label', role: 'rowheader' }, r.severity[sev]),
        h('span', { role: 'cell' }, cell(b[sev], sev)),
        h('span', { class: 'dr-ba-arrow', 'aria-hidden': 'true' }, icon('arrow-right', { size: 16 })),
        h('span', { role: 'cell' }, cell(a[sev], sev)),
      ),
    );
    const headRow = h(
      'div',
      { class: 'dr-ba-row dr-ba-headrow', role: 'row' },
      h('span', { role: 'columnheader' }),
      h('span', { class: 'dr-ba-col', role: 'columnheader' }, r.after.before),
      h('span', { 'aria-hidden': 'true' }),
      h('span', { class: 'dr-ba-col', role: 'columnheader' }, r.after.after),
    );
    const changes = s.changes.map(changeText).filter(Boolean) as string[];
    return h(
      'div',
      { class: 'dr-ba' },
      h('h3', { class: 'dr-sub' }, r.after.title),
      h('div', { class: 'dr-ba-table', role: 'table', 'aria-label': r.after.title }, headRow, rows),
      h('h4', { class: 'dr-sub-small' }, r.after.changes),
      changes.length ? h('ul', { class: 'dr-changes' }, changes.map((c) => h('li', null, icon('check', { size: 16 }), h('span', null, c)))) : h('p', { class: 'faint small' }, r.after.nothing),
    );
  }

  function changeText(c: Change): string {
    const T = r.change;
    switch (c.code) {
      case 'created':
        return c.file ? fmt(T.created, { file: c.file }) : fmt(T.createdMany, { count: c.count });
      case 'rewritten':
        return c.file ? fmt(T.rewritten, { file: c.file }) : fmt(T.rewrittenMany, { count: c.count });
      case 'extracted':
        return fmt(T.extracted, { file: c.file ?? '' });
      case 'extension':
        return fmt(T.extension, { ext: session?.before.edition === 'bedrock' ? '.mcpack' : '.zip' });
      case 'rebuilt':
        return T.rebuilt;
      case 'uuids':
        return T.uuids;
      default:
        return fmt(T[c.code], { count: c.count });
    }
  }

  function issueCard(i: Issue, s: Session): HTMLElement {
    const text = (r.issues as unknown as Record<IssueCode, IssueText>)[i.code];
    const variant = VARIANT[i.code]?.(i);
    const params = { ...i.params, version: target?.edition === 'java' ? target.version : String(i.params.version ?? '') } as Record<string, string | number>;
    if (typeof i.params.version === 'string') params.version = i.params.version;
    const say = (v: string | Record<string, string> | undefined) => {
      const m = pick(v, variant);
      return m === undefined ? null : fmt(m, params);
    };
    const affects = (() => {
      const A = r.affects;
      const ed = editionLabel(i.affects.edition);
      switch (i.affects.kind) {
        case 'from':
          return fmt(A.from, { edition: ed, from: i.affects.from ?? '' });
        case 'upTo':
          return fmt(A.upTo, { edition: ed, to: i.affects.to ?? '' });
        case 'target':
          return fmt(A.target, { edition: ed, version: target?.edition === 'java' ? target.version : '' }).trim();
        case 'mobile':
          return A.mobile;
        case 'some':
          return A.some;
        default:
          return fmt(A.all, { edition: ed });
      }
    })();
    const files = i.files.length
      ? h(
          'details',
          { class: 'dr-files' },
          h('summary', null, icon('file', { size: 16 }), h('span', null, fmt(r.actions.files, { count: i.count || i.files.length })), icon('chevron-down', { size: 16 })),
          h('ul', { class: 'cv-list dr-file-list' }, i.files.slice(0, LIST_LIMIT).map((f) => h('li', null, h('code', null, f)))),
          i.count > i.files.length ? h('p', { class: 'faint small cv-more' }, fmt(r.actions.more, { count: i.count - i.files.length })) : null,
        )
      : null;
    const footer = h('div', { class: 'dr-issue-foot' });
    const fixText = say(text.fix);
    const steps = say(text.steps);
    if (i.fix && fixText) {
      const b = button({ label: i.fix.safe ? r.actions.fix : r.actions.applyAnyway, icon: 'wand', variant: i.fix.safe ? 'secondary' : 'ghost', size: 'sm', class: 'dr-fix' });
      b.addEventListener('click', () => void act(b, () => fixOne(s, i)));
      footer.append(
        h('div', { class: 'dr-fix-row' }, b, h('div', { class: 'dr-fix-text' }, h('span', { class: ['dr-fix-kind', i.fix.safe ? 'is-safe' : 'is-unsafe'] }, i.fix.safe ? r.actions.safe : r.actions.unsafe), h('span', null, fixText))),
      );
    } else if (steps) {
      footer.append(h('div', { class: 'dr-steps' }, h('strong', null, r.actions.manual), h('span', null, steps)));
    }
    if (i.link) {
      const L = LINKS[i.link];
      footer.append(h('a', { class: 'btn btn-ghost btn-sm dr-link', href: routeHref(L.to) }, icon(L.icon), h('span', { class: 'btn-label' }, L.label())));
    }
    return h(
      'article',
      { class: ['dr-issue', `sev-${i.severity}`], dataset: { code: i.code } },
      h('header', { class: 'dr-issue-head' }, badge(r.severity[i.severity], i.severity === 'error' ? 'red' : i.severity === 'broken' ? 'gold' : i.severity === 'warning' ? 'blue' : 'gray'), h('h4', { class: 'dr-issue-title' }, say(text.title) ?? i.code)),
      h('p', { class: 'dr-issue-text' }, say(text.text)),
      i.detail ? h('div', { class: 'dr-detail' }, h('span', { class: 'faint small' }, r.actions.gameSays), h('code', null, i.detail)) : null,
      h('p', { class: 'dr-affects faint small' }, icon('gamepad', { size: 16 }), h('span', null, `${r.affects.label}: `, h('strong', null, affects))),
      files,
      footer.childNodes.length ? footer : null,
    );
  }

  function checkedList(list: Checked[], open: boolean, vanilla: boolean, edition: Edition | null): HTMLElement {
    const C = r.checked;
    const tgt = target ? targetText(target) : '';
    const line = (c: Checked): string => {
      switch (c.code) {
        case 'format':
          return fmt(C.format, { target: tgt });
        case 'folders':
          return fmt(C.folders, { target: tgt });
        case 'images':
        case 'json':
        case 'refs':
        case 'animations':
        case 'sounds':
          return fmt(C[c.code], { count: c.count ?? 0 });
        case 'texture-lists':
          return fmt(C.textureLists, { count: c.count ?? 0 });
        default:
          return C[c.code];
      }
    };
    const shown = list.filter((c) => c.count === undefined || c.count > 0);
    const items = shown.map((c) => h('li', null, icon('check', { size: 16 }), h('span', null, line(c))));
    const offline = !vanilla && edition ? h('p', { class: 'faint small dr-offline' }, icon('circle-info', { size: 16 }), h('span', null, C.offline)) : null;
    return h('details', { class: 'cv-group tone-ok dr-checked', open }, h('summary', null, h('span', { class: 'cv-group-title' }, C.title), h('span', { class: 'cv-count' }, num(shown.length)), icon('chevron-down', { size: 16 })), h('ul', { class: 'dr-checked-list' }, items), offline);
  }

  async function download(btn: HTMLButtonElement, box: HTMLElement) {
    if (!session) return;
    setButtonBusy(btn, true);
    try {
      const out = await buildFixed(session);
      if (!alive) return;
      saveBlob(out.blob, out.name);
      const bedrock = session.before.edition === 'bedrock';
      box.hidden = false;
      box.replaceChildren(
        h('div', { class: 'cv-file' }, icon('check', { size: 20 }), h('strong', null, out.name), h('span', { class: 'faint small' }, `${formatBytes(out.blob.size)} · ${fmt(r.download.saved, { count: out.count })}`)),
        h('p', { class: 'small muted' }, bedrock ? r.download.bedrock : r.download.java, h('a', { href: routeHref(`/help#${bedrock ? 'bedrock-packs' : 'java-packs'}`) }, r.download.help)),
      );
    } catch (err) {
      console.error(err);
      toast(friendlyError(err, r.download.failed), { tone: 'error' });
    } finally {
      setButtonBusy(btn, false);
    }
  }

  return {
    check: (source) => run(source),
    recheck: async () => {
      if (!archive) return;
      session = null;
      await run(null);
    },
    hasPack: () => !!archive,
    hasFixes: () => !!session?.files,
    clear,
    destroy() {
      alive = false;
      controller?.abort();
    },
  };
}

