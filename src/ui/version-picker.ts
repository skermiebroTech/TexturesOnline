// Edition + game version chooser, and the vanilla asset download panel.

import type { Edition, GameVersion, Progress } from '../core/types';
import { DEFAULT_JAVA_VERSION, getDefaultVersion, listVersions } from '../editions/index';
import { h, uid } from './dom';
import { icon } from './icons';
import { badge, button, progressBar, segmented, spinner, toggle } from './components';
import { openPopover, type PopoverHandle } from './popover';
import { editionName, formatPackFormat, shortDate, shortVersionName, versionGroup } from './format';

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
    h('span', { class: 'vp-current' }, nameEl, subEl),
    icon('chevron-down'),
  );

  const editionSeg = opts.allowEditionChange
    ? segmented<Edition>({
        value: edition,
        label: 'Edition',
        options: [
          { value: 'java', label: 'Java', icon: 'laptop' },
          { value: 'bedrock', label: 'Bedrock', icon: 'gamepad' },
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
    const name = shortVersionName(known?.name ?? (value ? (value === 'latest' ? 'Latest' : value) : 'Choose a version'));
    nameEl.textContent = `${editionName(edition)} ${name}`;
    const sub: string[] = [];
    if (edition === 'java' && known?.packFormat) sub.push(`pack ${formatPackFormat(known.packFormat)}`);
    if (known?.type === 'snapshot') sub.push('snapshot');
    if (known?.type === 'preview') sub.push('preview');
    subEl.textContent = sub.join(' · ');
    trigger.setAttribute('aria-label', `${opts.label ? `${opts.label}: ` : ''}Minecraft ${editionName(edition)} ${name}${sub.length ? `, ${sub.join(', ')}` : ''}. Change version`);
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
      placeholder: edition === 'java' ? 'Search versions, e.g. 1.20' : 'Search versions',
      role: 'combobox',
      'aria-controls': listId,
      'aria-expanded': 'true',
      'aria-autocomplete': 'list',
      'aria-label': 'Search versions',
      autocomplete: 'off',
      spellcheck: false,
    });
    const extrasToggle = toggle({
      label: edition === 'java' ? 'Show snapshots' : 'Show previews',
      value: extras,
      onChange: (v) => {
        extras = v;
        void fill();
      },
    });
    const list = h('div', { class: 'vp-list', role: 'listbox', id: listId, 'aria-label': 'Versions' });
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
      const shown = q ? versions.filter((v) => `${v.id} ${v.name}`.toLowerCase().includes(q)) : versions;
      list.replaceChildren();
      items = [];
      active = -1;
      if (!shown.length) {
        list.appendChild(h('div', { class: 'vp-empty' }, q ? `No versions match "${search.value.trim()}"` : 'No versions available'));
        return;
      }
      const latestRelease = versions.find((v) => v.type === 'release');
      let group = '';
      const frag = document.createDocumentFragment();
      for (const v of shown) {
        const g = versionGroup(v);
        if (g !== group) {
          group = g;
          frag.appendChild(h('div', { class: 'vp-group', role: 'presentation' }, g));
        }
        const selected = v.id === value;
        const meta: (HTMLElement | string)[] = [];
        if (v.edition === 'java' && v.id === DEFAULT_JAVA_VERSION) meta.push(badge('Default', 'green'));
        else if (v === latestRelease && v.edition === 'java') meta.push(badge('Latest', 'blue'));
        if (v.type === 'snapshot') meta.push(badge('Snapshot', 'gold'));
        if (v.type === 'preview') meta.push(badge('Preview', 'purple'));
        const metaText = v.edition === 'java' ? (v.packFormat ? `pack ${formatPackFormat(v.packFormat)}` : '') : shortDate(v.releaseTime);
        const item = h(
          'div',
          { class: 'vp-item', role: 'option', id: uid('vp-opt'), 'aria-selected': String(selected) },
          h('span', { class: 'vp-check' }, selected ? icon('check') : null),
          h('span', { class: 'vp-item-name' }, v.name),
          meta,
          metaText ? h('span', { class: 'vp-item-meta' }, metaText) : null,
        );
        const index = items.length;
        item.addEventListener('click', () => choose(v));
        item.addEventListener('pointermove', () => {
          if (active !== index) setActive(index, false);
        });
        items.push({ v, el: item });
        frag.appendChild(item);
      }
      list.appendChild(frag);
      const sel = items.findIndex((it) => it.v.id === value);
      setActive(sel >= 0 && !q ? sel : 0);
    };

    const fill = async () => {
      list.replaceChildren(h('div', { class: 'vp-status' }, spinner(20), 'Loading versions…'));
      try {
        versions = await loadList(edition, extras);
        render();
      } catch (err) {
        console.error(err);
        const retry = button({ label: 'Try again', icon: 'reload', size: 'sm', onClick: () => void fill() });
        list.replaceChildren(
          h(
            'div',
            { class: 'vp-status', style: { flexDirection: 'column', alignItems: 'flex-start' } },
            h('span', null, navigator.onLine ? "Couldn't load the version list." : "You're offline, so the version list can't be loaded."),
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
      label: 'Choose a game version',
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
  const edition = opts.edition ?? 'java';
  const iconBox = h('div', { class: 'asset-panel-icon' }, icon('download', { size: 24 }));
  const title = h('h3', null, edition === 'java' ? `Getting Minecraft${opts.version ? ` ${opts.version}` : ''} textures` : 'Getting Bedrock textures');
  const subtitle = h('p', { class: 'muted' }, 'One-time download — next time it opens instantly.');
  const progress = progressBar({ label: 'Starting…' });
  progress.set({ label: 'Starting…', fraction: null });
  const note = h(
    'div',
    { class: 'asset-panel-note' },
    icon('lock'),
    h(
      'span',
      null,
      edition === 'java'
        ? "Your browser downloads the official game files straight from Mojang's servers and keeps only the textures, models and shaders on this device. Nothing is uploaded."
        : "Textures come straight from Mojang's official bedrock-samples repository on GitHub and are cached on this device as you browse. Nothing is uploaded.",
    ),
  );
  const errorText = h('p', { class: 'asset-panel-error', role: 'alert', hidden: true });
  const actions = h('div', { class: 'asset-panel-actions' });
  const help = h('p', { class: 'field-desc', hidden: true });

  const el = h(
    'section',
    { class: 'asset-panel', 'aria-live': 'polite' },
    h('div', { class: 'asset-panel-head' }, iconBox, h('div', { class: 'stack', style: { '--gap': '4px' } }, title, subtitle)),
    progress,
    errorText,
    note,
    actions,
    help,
  ) as unknown as HTMLElement & { set(p: Progress | null): void; error(msg: string, retry?: () => void, pickJar?: (f: File) => void): void };

  const jarPicker = (onPick: (f: File) => void, primary = false) => {
    const input = h('input', { type: 'file', accept: '.jar,application/java-archive,application/zip', hidden: true });
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      input.value = '';
      if (f) onPick(f);
    });
    const b = button({
      label: 'Use my own .jar',
      icon: 'folder',
      variant: primary ? 'primary' : 'secondary',
      onClick: () => input.click(),
    });
    return [b, input];
  };

  const jarHelp = () => {
    help.hidden = false;
    help.replaceChildren(
      'Your Minecraft folder has it: ',
      h('code', null, `.minecraft/versions/${opts.version ?? '<version>'}/${opts.version ?? '<version>'}.jar`),
      '. Play that version once in the Minecraft Launcher so the file exists.',
    );
  };

  const renderLoadingActions = () => {
    actions.replaceChildren();
    if (opts.onCancel) actions.appendChild(button({ label: 'Cancel', variant: 'ghost', onClick: opts.onCancel }));
    if (opts.onPickJar && edition === 'java') {
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
      progress.set({ label: 'Ready', fraction: 1 });
      subtitle.textContent = 'All set.';
      actions.hidden = true;
      help.hidden = true;
      return;
    }
    if (el.classList.contains('is-done') || iconBox.querySelector('[data-icon="square-alert"]')) {
      el.classList.remove('is-done');
      iconBox.replaceChildren(icon('download'));
      subtitle.textContent = 'One-time download — next time it opens instantly.';
      renderLoadingActions();
    }
    progress.set(p);
  };

  el.error = (msg: string, retry?: () => void, pickJar?: (f: File) => void) => {
    el.classList.remove('is-done');
    el.classList.add('is-error');
    iconBox.replaceChildren(icon('square-alert'));
    subtitle.textContent = "Couldn't get the game files.";
    progress.hidden = true;
    errorText.hidden = false;
    errorText.textContent = msg;
    actions.replaceChildren();
    if (retry) actions.appendChild(button({ label: 'Try again', icon: 'reload', variant: 'primary', onClick: retry }));
    const pick = pickJar ?? opts.onPickJar;
    if (pick && edition === 'java') {
      actions.append(...jarPicker(pick, !retry));
      jarHelp();
    } else {
      help.hidden = true;
    }
    actions.hidden = actions.childElementCount === 0;
  };
  return el;
}
