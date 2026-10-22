// Centre panel in GUI mode while "Splash texts" is open: the title screen's splash texts. Until the
// pack has its own list it shows the game's (Java) with "Edit these" / "Start an empty list"; after
// that every text can be changed in place, removed (undo from the toast), added (pasting several
// lines adds them all) and shown on the title screen preview. The list is saved as the pack's
// texts/splashes.txt (Java) or splashes.json (Bedrock).

import { h } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { button, iconButton, spinner, tooltip } from '../../../ui/components';
import { toast } from '../../../ui/toast';
import { friendlyError } from '../../../core/net';
import { fmt, num } from '../../../i18n/editor-text';
import type { TexStore } from '../ui/store';
import { SPLASH_LONG, SPLASH_MAX, addSplashes, cleanSplash, packSplashes, parseSplashes, splashPath, splashesBlob } from './splashes';
import { tg } from './i18n/text';

export interface SplashEditor {
  el: HTMLElement;
  /** Shown in the centre (loads the lists the first time) */
  show(): void;
  /** The list the title screen uses now (the pack's, else the game's; null while unknown) */
  current(): Promise<string[] | null>;
  destroy(): void;
}

export interface SplashEditorOptions {
  store: TexStore;
  /** Show a splash on the title screen preview */
  preview(text: string): void;
  /** The pack's list changed (null: the game's list is used) */
  onCount(n: number | null): void;
  /** Phones and tablets: back to the list */
  onBrowse(): void;
}

export function createSplashEditor(opts: SplashEditorOptions): SplashEditor {
  const { store } = opts;
  const project = store.project;
  const path = splashPath(project.edition);
  /** The pack's list (null: the pack has none) */
  let mine: string[] | null = null;
  let game: string[] | null = null;
  let gameError = '';
  let loaded: Promise<void> | null = null;
  let query = '';
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const countPill = h('span', { class: 'tx-count-pill' });
  const head = h(
    'header',
    { class: 'gui-sp-head' },
    iconButton('arrow-left', tg.splash.back, () => opts.onBrowse(), { class: 'gui-sp-back' }),
    h('span', { class: 'gui-sp-icon', 'aria-hidden': 'true' }, icon('notes')),
    h('div', { class: 'gui-sp-titles' }, h('h2', { class: 'gui-sp-title' }, tg.splash.title), h('code', { class: 'gui-sp-file' }, path)),
    countPill,
  );
  const body = h('div', { class: 'gui-sp-body scroll' });
  const el = h('section', { class: 'panel gui-sp', 'aria-label': tg.splash.title }, head, body);

  async function load() {
    mine = await packSplashes(project);
    if (project.edition === 'java') {
      try {
        game = store.assets.hasFile(path) ? parseSplashes('java', await store.assets.readText(path)) : [];
      } catch (err) {
        gameError = friendlyError(err);
        game = null;
      }
    } else game = [];
    opts.onCount(mine ? mine.length : null);
  }
  const ensure = () => (loaded ??= load());

  function save(list: string[] | null, now = false) {
    mine = list;
    const write = () => {
      saveTimer = null;
      store.setExtraFiles({ [path]: splashesBlob(project.edition, mine) });
    };
    if (saveTimer) clearTimeout(saveTimer);
    if (now) write();
    else saveTimer = setTimeout(write, 400);
    opts.onCount(mine ? mine.length : null);
    countPill.textContent = num((mine ?? game ?? []).length);
  }

  // ---------------------------------------------------------------- rendering
  function render() {
    const shown = mine ?? game ?? [];
    countPill.textContent = num(shown.length);
    countPill.title = fmt(tg.splash.count, { count: shown.length });
    const intro = h(
      'div',
      { class: 'tx-note gui-sp-intro' },
      icon('notes'),
      h('p', null, tg.splash.intro, ' ', project.edition === 'java' ? tg.splash.javaReplaces : tg.splash.bedrockNote),
    );
    if (!mine) {
      const rows = game ?? [];
      fill(
        intro,
        h(
          'div',
          { class: 'gui-sp-start' },
          button({ label: tg.splash.editThese, icon: 'pencil', variant: 'primary', class: 'gui-sp-edit', onClick: () => startWith(game ?? []) }),
          button({ label: tg.splash.startEmpty, icon: 'plus', variant: 'secondary', class: 'gui-sp-empty', onClick: () => startWith([]) }),
        ),
        gameError ? h('p', { class: 'tx-inline-note warn' }, icon('warning-diamond', { size: 16 }), h('span', null, fmt(tg.splash.loadFailed, { error: gameError }))) : null,
        rows.length
          ? h(
              'section',
              { class: 'gui-sp-game', 'aria-label': tg.splash.gameList },
              h('h3', { class: 'tx-h' }, tg.splash.gameList, ' ', h('span', { class: 'tx-count-pill' }, num(rows.length))),
              h('ul', { class: 'gui-sp-readonly' }, rows.map((s) => h('li', null, showBtn(s), h('span', { class: 'gui-sp-text' }, s)))),
            )
          : null,
      );
      return;
    }
    const input = h('textarea', { class: 'input gui-sp-new', rows: 1, maxLength: SPLASH_MAX * 20, placeholder: tg.splash.newText, 'aria-label': tg.splash.newText, spellcheck: true });
    const addBtn = button({ label: tg.splash.add, icon: 'plus', variant: 'primary', class: 'gui-sp-add', onClick: () => add() });
    const add = () => {
      const texts = input.value.split(/\r?\n/);
      const res = addSplashes(mine!, texts);
      if (!res.added) {
        if (input.value.trim()) toast(tg.splash.duplicate, { tone: 'info' });
        return;
      }
      input.value = '';
      autosize(input);
      save(res.list, true);
      toast(fmt(tg.splash.added, { count: res.added }), { tone: 'success', duration: 1800 });
      opts.preview(res.list[res.list.length - 1]);
      renderList();
      list.lastElementChild?.scrollIntoView({ block: 'nearest' });
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        add();
      }
    });
    input.addEventListener('input', () => autosize(input));
    const search = h('input', { class: 'input gui-sp-search', type: 'search', placeholder: tg.splash.search, 'aria-label': tg.splash.search, value: query, autocomplete: 'off' });
    search.addEventListener('input', () => {
      query = search.value.trim().toLowerCase();
      renderList();
    });
    const list = h('ol', { class: 'gui-sp-list' });
    const resetBtn = button({
      label: tg.splash.reset,
      icon: 'reset',
      size: 'sm',
      variant: 'ghost',
      class: 'gui-sp-reset',
      onClick: () => {
        const before = mine;
        save(null, true);
        render();
        toast(tg.splash.resetDone, {
          tone: 'success',
          action: {
            label: tg.splash.undo,
            onClick: () => {
              save(before, true);
              render();
            },
          },
        });
      },
    });
    function renderList() {
      const rows = mine!.map((s, i) => ({ s, i })).filter((r) => !query || r.s.toLowerCase().includes(query));
      if (!mine!.length) list.replaceChildren(h('li', { class: 'gui-sp-none muted' }, tg.splash.none));
      else if (!rows.length) list.replaceChildren(h('li', { class: 'gui-sp-none muted' }, fmt(tg.splash.noMatch, { query })));
      else list.replaceChildren(...rows.map((r) => row(r.s, r.i)));
      countPill.textContent = num(mine!.length);
    }
    function row(text: string, i: number): HTMLElement {
      const field = h('input', { class: 'input gui-sp-field', value: text, maxLength: SPLASH_MAX, 'aria-label': fmt(tg.splash.edit, { n: i + 1 }), spellcheck: true });
      const long = h('span', { class: 'gui-sp-long', hidden: text.length <= SPLASH_LONG, 'aria-label': tg.splash.long }, icon('warning-diamond', { size: 16 }));
      tooltip(long, tg.splash.long);
      field.addEventListener('input', () => {
        const v = cleanSplash(field.value);
        long.hidden = v.length <= SPLASH_LONG;
        if (!v) return;
        const next = [...mine!];
        next[i] = v;
        save(next);
        opts.preview(v);
      });
      field.addEventListener('focus', () => opts.preview(cleanSplash(field.value) || text));
      field.addEventListener('blur', () => {
        if (!cleanSplash(field.value)) field.value = mine![i] ?? text;
      });
      const del = iconButton('trash', fmt(tg.splash.remove, { n: i + 1 }), () => {
        const before = [...mine!];
        save(mine!.filter((_, k) => k !== i), true);
        renderList();
        toast(tg.splash.removed, {
          action: {
            label: tg.splash.undo,
            onClick: () => {
              save(before, true);
              render();
            },
          },
        });
      });
      del.classList.add('gui-sp-del');
      return h('li', { class: 'gui-sp-row' }, showBtn(text), field, long, del);
    }
    body.replaceChildren(
      intro,
      h('div', { class: 'gui-sp-addrow' }, input, addBtn),
      h('p', { class: 'field-desc gui-sp-hint' }, tg.splash.addHint),
      h('div', { class: 'gui-sp-tools' }, h('h3', { class: 'tx-h' }, tg.splash.yourList), search),
      list,
      h('div', { class: 'gui-sp-foot' }, h('span', { class: 'faint' }, fmt(tg.splash.saved, { file: path })), resetBtn),
    );
    renderList();
  }

  function fill(...nodes: (Node | null)[]) {
    body.replaceChildren(...nodes.filter((n): n is Node => !!n));
  }

  function showBtn(text: string): HTMLElement {
    const b = iconButton('eye', tg.splash.show, () => opts.preview(text), { class: 'gui-sp-show' });
    return b;
  }

  function startWith(list: string[]) {
    save([...list], true);
    render();
    if (list.length) opts.preview(list[Math.floor(Math.random() * list.length)]);
    requestAnimationFrame(() => el.querySelector<HTMLTextAreaElement>('.gui-sp-new')?.focus());
  }

  function autosize(t: HTMLTextAreaElement) {
    t.style.height = 'auto';
    t.style.height = `${Math.min(160, t.scrollHeight + 2)}px`;
  }

  return {
    el,
    show() {
      body.replaceChildren(h('div', { class: 'gui-sp-loading' }, spinner(24), h('span', { class: 'muted' }, tg.splash.loading)));
      void ensure().then(render);
    },
    async current() {
      await ensure();
      return mine ?? game;
    },
    destroy() {
      if (saveTimer) {
        clearTimeout(saveTimer);
        store.setExtraFiles({ [path]: splashesBlob(project.edition, mine) });
      }
    },
  };
}
