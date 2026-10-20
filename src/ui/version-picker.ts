// Edition + game version chooser, and the vanilla asset download panel.

import type { Edition, GameVersion, Progress } from '../core/types';
import { DEFAULT_JAVA_VERSION, getDefaultVersion, listVersions } from '../editions/versions';
import { h, uid } from './dom';
import { icon } from './icons';
import { badge, button, progressBar, segmented, spinner, toggle } from './components';
import { openPopover, type PopoverHandle } from './popover';
import { editionName, formatPackFormat, groupVersions, listVersionName, shortDate, shortVersionName, versionName } from './format';
import { kit } from './i18n/kit';
import { pickers } from '../shared/i18n/pickers';
import { fmt, fmtNodes } from '../i18n/editor-text';

export { editionName, formatPackFormat } from './format';

const listCache = new Map<string, Promise<GameVersion[]>>();

function loadList(edition: Edition, extras: boolean): Promise<GameVersion[]> {
  const key = `${edition}:${extras}`;
  let p = listCache.get(key);
  if (!p) {
    p = listVersions(edition, { includeSnapshots: extras }).catch((err) => {
      listCache.delete(key);
      throw err;
    });
    listCache.set(key, p);
  }
  return p;
}

export function versionPicker(opts: {
  edition: Edition;
  value: string;
  onChange: (edition: Edition, versionId: string) => void;
  allowEditionChange?: boolean;
  includeSnapshots?: boolean;
  label?: string;
}): HTMLElement & { setValue(edition: Edition, versionId: string): void; getValue(): { edition: Edition; version: string } } {
  let edition = opts.edition;
  let value = opts.value;
  let extras = Boolean(opts.includeSnapshots);
  let known: GameVersion | undefined;
  let pop: PopoverHandle | null = null;

  const labelId = uid('vp-label');
  const nameEl = h('span', { class: 'vp-name' });
  const subEl = h('span', { class: 'vp-sub' });
  const trigger = h(
    'button',
    { type: 'button', class: 'vp-trigger', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' },
    icon('box'),
    // the space is not drawn (flex), but keeps the words apart in the text the label must contain
    h('span', { class: 'vp-current' }, nameEl, ' ', subEl),
    icon('chevron-down'),
  );

  const editionSeg = opts.allowEditionChange
    ? segmented<Edition>({
        value: edition,
        label: pickers.version.edition,
        options: [
          { value: 'java', label: kit.edition.java, icon: 'laptop' },
          { value: 'bedrock', label: kit.edition.bedrock, icon: 'gamepad' },
        ],
        onChange: (e) => void switchEdition(e),
      })
    : null;

  const el = h(
    'div',
    { class: 'version-picker' },
    opts.label ? h('div', { class: 'field-label', id: labelId }, opts.label) : null,
    editionSeg,
    trigger,
  ) as unknown as HTMLElement & { setValue(edition: Edition, versionId: string): void; getValue(): { edition: Edition; version: string } };

  const paintTrigger = () => {
    const name = known ? shortVersionName(listVersionName(known)) : shortVersionName(value ? (value === 'latest' ? pickers.version.latest : value) : pickers.version.choose);
    nameEl.textContent = `${editionName(edition)} ${name}`;
    const sub: string[] = [];
    if (edition === 'java' && known?.packFormat) sub.push(fmt(pickers.version.packFormat, { format: formatPackFormat(known.packFormat) }));
    if (known?.type === 'snapshot') sub.push(pickers.version.snapshot);
    if (known?.type === 'preview') sub.push(pickers.version.preview);
    subEl.textContent = sub.join(' · ');
    trigger.setAttribute('aria-label', `${opts.label ? `${opts.label}: ` : ''}${fmt(pickers.version.buttonLabel, { edition: editionName(edition), version: name, details: sub.length ? `, ${sub.join(', ')}` : '' })}`);
  };

  const refreshKnown = async () => {
    const e = edition;
    const v = value;
    try {
      const snapshotsNeeded = edition === 'java' && !/^\d+\.\d+(\.\d+)?$/.test(v);
      const bedrockPreview = edition === 'bedrock' && /preview/.test(v);
      const list = await loadList(e, extras || snapshotsNeeded || bedrockPreview);
      if (e !== edition || v !== value) return;
      known = list.find((x) => x.id === v);
      paintTrigger();
    } catch {
      /* the popover shows the error with a retry */
    }
  };

  async function switchEdition(e: Edition) {
    if (e === edition) return;
    edition = e;
    extras = false;
    known = undefined;
    value = '';
    nameEl.textContent = `${editionName(edition)} …`;
    subEl.textContent = '';
    try {
      value = await getDefaultVersion(e);
    } catch {
      value = e === 'java' ? DEFAULT_JAVA_VERSION : 'latest';
    }
    if (e !== edition) return;
    paintTrigger();
    opts.onChange(edition, value);
    void refreshKnown();
  }

  // ---- popover ----
  function openList() {
    if (pop?.open) {
      pop.close();
      return;
    }
    const listId = uid('vp-list');
    const search = h('input', {
      class: 'input',
      type: 'search',
      placeholder: edition === 'java' ? pickers.version.searchJava : pickers.version.search,
      role: 'combobox',
      'aria-controls': listId,
      'aria-expanded': 'true',
      'aria-autocomplete': 'list',
      'aria-label': pickers.version.search,
      autocomplete: 'off',
      spellcheck: false,
    });
    const extrasToggle = toggle({
      label: edition === 'java' ? pickers.version.showSnapshots : pickers.version.showPreviews,
      value: extras,
      onChange: (v) => {
        extras = v;
        void fill();
      },
    });
    const list = h('div', { class: 'vp-list', role: 'listbox', id: listId, 'aria-label': pickers.version.versions });
    const content = h(
      'div',
      { class: 'vp-pop' },
      h('div', { class: 'vp-pop-head' }, h('div', { class: 'input-with-icon' }, icon('search'), search), extrasToggle),
      list,
    );

    let items: { v: GameVersion; el: HTMLElement }[] = [];
    let versions: GameVersion[] = [];
    let active = -1;

    const setActive = (i: number, scroll = true) => {
      if (active >= 0 && items[active]) items[active].el.classList.remove('active');
      active = i;
      const it = items[i];
      if (!it) {
        search.removeAttribute('aria-activedescendant');
        return;
      }
      it.el.classList.add('active');
      search.setAttribute('aria-activedescendant', it.el.id);
      if (scroll) it.el.scrollIntoView({ block: 'nearest' });
    };

    const choose = (v: GameVersion) => {
      value = v.id;
      known = v;
      paintTrigger();
      pop?.close();
      opts.onChange(edition, value);
    };

    const render = () => {
      const q = search.value.trim().toLowerCase();
      const shown = q ? versions.filter((v) => `${v.id} ${v.name} ${versionName(v.name)}`.toLowerCase().includes(q)) : versions;
      list.replaceChildren();
      items = [];
      active = -1;
      if (!shown.length) {
        list.appendChild(h('div', { class: 'vp-empty' }, q ? fmt(pickers.version.noMatch, { query: search.value.trim() }) : pickers.version.none));
        return;
      }
      const latestRelease = versions.find((v) => v.type === 'release');
      const frag = document.createDocumentFragment();
      for (const { label, items: groupItems } of groupVersions(shown)) {
        const groupEl = h('div', { role: 'group', 'aria-label': label }, h('div', { class: 'vp-group', 'aria-hidden': 'true' }, label));
        frag.appendChild(groupEl);
        for (const v of groupItems) {
          const selected = v.id === value;
          const meta: (HTMLElement | string)[] = [];
          if (v.edition === 'java' && v.id === DEFAULT_JAVA_VERSION) meta.push(badge(pickers.version.badgeDefault, 'green'));
          else if (v === latestRelease && v.edition === 'java') meta.push(badge(pickers.version.badgeLatest, 'blue'));
          // Snapshot ids ("26.3-rc-2", "24w14a") and Bedrock preview names already say what they are
          // and sit under their own headings; a badge would squeeze the name out of the narrow list.
          if (v.type === 'snapshot') meta.push(h('span', { class: 'sr-only' }, pickers.version.snapshotSuffix));
          const metaText = v.edition === 'java' ? (v.packFormat ? fmt(pickers.version.packFormat, { format: formatPackFormat(v.packFormat) }) : '') : shortDate(v.releaseTime);
          const item = h(
            'div',
            { class: ['vp-item', v.type !== 'release' && 'snapshot'], role: 'option', id: uid('vp-opt'), 'aria-selected': String(selected) },
            h('span', { class: 'vp-check' }, selected ? icon('check') : null),
            h('span', { class: 'vp-item-name', title: listVersionName(v) !== versionName(v.name) ? versionName(v.name) : undefined }, listVersionName(v)),
            meta,
            metaText ? h('span', { class: 'vp-item-meta' }, metaText) : null,
          );
          const index = items.length;
          item.addEventListener('click', () => choose(v));
          item.addEventListener('pointermove', () => {
            if (active !== index) setActive(index, false);
          });
          items.push({ v, el: item });
          groupEl.appendChild(item);
        }
      }
      list.appendChild(frag);
      const sel = items.findIndex((it) => it.v.id === value);
      setActive(sel >= 0 && !q ? sel : 0);
    };

    const fill = async () => {
      list.replaceChildren(h('div', { class: 'vp-status' }, spinner(20), pickers.version.loading));
      try {
        versions = await loadList(edition, extras);
        render();
      } catch (err) {
        console.error(err);
        const retry = button({ label: kit.tryAgain, icon: 'reload', size: 'sm', onClick: () => void fill() });
        list.replaceChildren(
          h(
            'div',
            { class: 'vp-status', style: { flexDirection: 'column', alignItems: 'flex-start' } },
            h('span', null, navigator.onLine ? pickers.version.loadFailed : pickers.version.offline),
            retry,
          ),
        );
      }
    };

    search.addEventListener('input', render);
    search.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive(Math.min(items.length - 1, active + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(Math.max(0, active - 1));
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        setActive(Math.min(items.length - 1, active + 8));
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        setActive(Math.max(0, active - 8));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const it = items[active];
        if (it) choose(it.v);
      }
    });

    trigger.setAttribute('aria-expanded', 'true');
    pop = openPopover(trigger, content, {
      placement: 'bottom-start',
      matchWidth: true,
      focus: search,
      role: 'dialog',
      label: pickers.version.dialog,
      onClose: () => trigger.setAttribute('aria-expanded', 'false'),
    });
    void fill();
  }

  trigger.addEventListener('click', openList);
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openList();
    }
  });

  el.setValue = (e: Edition, v: string) => {
    edition = e;
    value = v;
    known = undefined;
    editionSeg?.setValue(e);
    paintTrigger();
    void refreshKnown();
  };
  el.getValue = () => ({ edition, version: value });

  paintTrigger();
  if (!value) {
    getDefaultVersion(edition)
      .then((v) => {
        if (value) return;
        value = v;
        paintTrigger();
        opts.onChange(edition, value);
        void refreshKnown();
      })
      .catch(() => undefined);
  } else {
    void refreshKnown();
  }
  return el;
}

// ---------------------------------------------------------------------------------------------

export function assetLoadingPanel(
  opts: { edition?: Edition; version?: string; onPickJar?: (f: File) => void; onCancel?: () => void } = {},
): HTMLElement & { set(p: Progress | null): void; error(msg: string, retry?: () => void, pickJar?: (f: File) => void): void } {
  // Without an edition the copy stays neutral (the spec'd zero-argument call is used for both).
  const edition = opts.edition;
  const javaLike = edition !== 'bedrock';
  const iconBox = h('div', { class: 'asset-panel-icon' }, icon('download', { size: 24 }));
  const P = pickers.assets;
  const title = h('h3', null, edition === 'bedrock' ? P.titleBedrock : opts.version ? fmt(P.titleJavaVersion, { version: opts.version }) : P.titleJava);
  const subtitle = h('p', { class: 'muted' }, P.oneTime);
  const progress = progressBar({ label: P.starting });
  progress.set({ label: P.starting, fraction: null });
  const note = h(
    'div',
    { class: 'asset-panel-note' },
    icon('lock'),
    h(
      'span',
      null,
      edition === 'java'
        ? P.noteJava
        : edition === 'bedrock'
          ? P.noteBedrock
          : P.note,
    ),
  );
  const errorText = h('p', { class: 'asset-panel-error', role: 'alert', hidden: true });
  const actions = h('div', { class: 'asset-panel-actions' });
  const help = h('p', { class: 'field-desc', hidden: true });
  // Only coarse state changes are announced; the progress bar itself carries the percentage.
  const status = h('span', { class: 'sr-only', role: 'status' });

  const el = h(
    'section',
    { class: 'asset-panel', 'aria-labelledby': uid('asset-title') },
    h('div', { class: 'asset-panel-head' }, iconBox, h('div', { class: 'stack', style: { '--gap': '4px' } }, title, subtitle)),
    progress,
    errorText,
    note,
    actions,
    help,
    status,
  ) as unknown as HTMLElement & { set(p: Progress | null): void; error(msg: string, retry?: () => void, pickJar?: (f: File) => void): void };
  title.id = el.getAttribute('aria-labelledby') ?? '';

  const jarPicker = (onPick: (f: File) => void, primary = false) => {
    const input = h('input', { type: 'file', accept: '.jar,application/java-archive,application/zip', hidden: true });
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      input.value = '';
      if (f) onPick(f);
    });
    const b = button({
      label: P.useJar,
      icon: 'folder',
      variant: primary ? 'primary' : 'secondary',
      onClick: () => input.click(),
    });
    return [b, input];
  };

  const jarHelp = () => {
    help.hidden = false;
    help.replaceChildren(...fmtNodes(P.jarHelp, { path: h('code', null, `.minecraft/versions/${opts.version ?? '<version>'}/${opts.version ?? '<version>'}.jar`) }));
  };

  const renderLoadingActions = () => {
    actions.replaceChildren();
    if (opts.onCancel) actions.appendChild(button({ label: kit.cancel, variant: 'ghost', onClick: opts.onCancel }));
    if (opts.onPickJar && javaLike) {
      actions.append(...jarPicker(opts.onPickJar));
      jarHelp();
    }
    actions.hidden = actions.childElementCount === 0;
  };
  renderLoadingActions();

  el.set = (p: Progress | null) => {
    el.classList.remove('is-error');
    errorText.hidden = true;
    progress.hidden = false;
    if (p === null) {
      el.classList.add('is-done');
      iconBox.replaceChildren(icon('check'));
      progress.set({ label: P.ready, fraction: 1 });
      subtitle.textContent = P.allSet;
      status.textContent = P.filesReady;
      actions.hidden = true;
      help.hidden = true;
      return;
    }
    if (!status.textContent || status.textContent === P.filesReady) status.textContent = P.downloading;
    if (el.classList.contains('is-done') || iconBox.querySelector('[data-icon="square-alert"]')) {
      el.classList.remove('is-done');
      iconBox.replaceChildren(icon('download'));
      subtitle.textContent = P.oneTime;
      renderLoadingActions();
    }
    progress.set(p);
  };

  el.error = (msg: string, retry?: () => void, pickJar?: (f: File) => void) => {
    el.classList.remove('is-done');
    el.classList.add('is-error');
    iconBox.replaceChildren(icon('square-alert'));
    subtitle.textContent = P.failed;
    progress.hidden = true;
    errorText.hidden = false;
    errorText.textContent = msg;
    actions.replaceChildren();
    if (retry) actions.appendChild(button({ label: kit.tryAgain, icon: 'reload', variant: 'primary', onClick: retry }));
    const pick = pickJar ?? opts.onPickJar;
    status.textContent = '';
    if (pick && javaLike) {
      actions.append(...jarPicker(pick, !retry));
      jarHelp();
    } else {
      help.hidden = true;
    }
    actions.hidden = actions.childElementCount === 0;
  };
  return el;
}
