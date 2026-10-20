// Centre panel in Sounds mode: the selected sound event and its files. Each file can be played
// (the pack's version or the game's), replaced with an upload or a recording, trimmed on its
// waveform, made louder or quieter, and reset. Edits are saved as Ogg Vorbis in the pack.

import { h, formatBytes } from '../../../ui/dom';
import { icon, setIcon } from '../../../ui/icons';
import { badge, button, emptyState, iconButton, openMenu, slider, spinner, toggle, tooltip, type MenuItem } from '../../../ui/components';
import { toast } from '../../../ui/toast';
import { saveBlob } from '../../../core/download';
import { friendlyError, isAbortError } from '../../../core/net';
import type { SoundEvent, SoundVariant } from '../sounds/catalog';
import { fmt, num, textLocale } from '../../../i18n/editor-text';
import { ts } from './i18n/sounds';
import { clampParams, normaliseGain, peakOf, soundRange, type RenderParams } from '../sounds/render';
import type { Samples } from '../sounds/audio';
import { SOUND_CATEGORY_ICONS } from './sound-browser';
import { createWaveform, type WaveformApi } from './sound-waveform';
import { openRecorder, recordingSupported } from './sound-record';
import type { SoundState } from './sound-store';

export interface SoundPanelApi {
  el: HTMLElement;
  show(e: SoundEvent | null): void;
  current(): SoundEvent | null;
  destroy(): void;
}

export interface SoundPanelOptions {
  sounds: SoundState;
  /** Another event was picked (from "Also heard in") */
  onPick(e: SoundEvent): void;
  /** Phones: back to the list */
  onBrowse(): void;
}

const ACCEPT = 'audio/*,.ogg,.oga,.mp3,.wav,.flac,.m4a,.aac,.webm,.opus,.weba';

interface Card {
  v: SoundVariant;
  el: HTMLElement;
  edited: boolean;
  source: Blob | undefined;
  wave: WaveformApi | null;
  /** live values while editing (before they are saved) */
  params: RenderParams | null;
  samples: Samples | null;
  update(): void;
  destroy(): void;
}

/** A label inside a sentence ("Play sound 2"): lower case where the language writes it so. */
function inSentence(label: string): string {
  const l = textLocale();
  return l === 'de' || l === 'ja' ? label : label.toLowerCase();
}

/** A number with fixed decimals in the page's language (2.50 / 2,50). */
const decimal = (v: number, digits: number): string => (textLocale() === 'en' ? v.toFixed(digits) : num(v, { minimumFractionDigits: digits, maximumFractionDigits: digits }));

export function createSoundPanel(opts: SoundPanelOptions): SoundPanelApi {
  const { sounds } = opts;
  let event: SoundEvent | null = null;
  let cards: Card[] = [];
  const pending = new Set<string>();
  const cleanups: (() => void)[] = [];

  // ---- header ----
  const headIcon = h('span', { class: 'snd-head-icon', 'aria-hidden': 'true' }, icon('music'));
  const headTitle = h('h2', { class: 'tx-head-title truncate' }, ts.panel.sounds);
  const headBadges = h('span', { class: 'tx-head-badges' });
  const headSub = h('span', { class: 'tx-head-sub truncate' });
  const backBtn = iconButton('arrow-left', ts.panel.back, () => opts.onBrowse(), { size: 'sm', class: 'snd-back' });
  const playBtn = button({ label: ts.panel.play, icon: 'play', variant: 'secondary', size: 'sm', class: 'snd-play-event', title: ts.panel.playHint });
  const replaceBtn = button({ label: ts.panel.replace, icon: 'upload', variant: 'ghost', size: 'sm', class: 'snd-replace-all' });
  const moreBtn = iconButton('more-vertical', ts.panel.more, () => openMore(), { size: 'sm' });
  const header = h(
    'header',
    { class: 'tx-texhead snd-head' },
    backBtn,
    headIcon,
    h('div', { class: 'tx-head-text' }, h('div', { class: 'row', style: { '--gap': '8px' } }, headTitle, headBadges), headSub),
    h('div', { class: 'tx-head-actions' }, playBtn, replaceBtn, moreBtn),
  );
  const intro = h('p', { class: 'snd-intro' });
  const varsEl = h('div', { class: 'snd-vars' });
  const refsEl = h('div', { class: 'snd-refs', hidden: true });
  const body = h('div', { class: 'snd-body scroll' }, intro, varsEl, refsEl);
  const emptyEl = h(
    'div',
    { class: 'snd-empty' },
    emptyState({
      icon: 'music',
      title: ts.panel.pickTitle,
      text: ts.panel.pickText,
      action: button({ label: ts.panel.browse, icon: 'bulletlist', size: 'sm', class: 'snd-empty-browse', onClick: () => opts.onBrowse() }),
    }),
  );
  const fileInput = h('input', { type: 'file', accept: ACCEPT, hidden: true, 'aria-hidden': 'true', tabIndex: -1 });
  const el = h('section', { class: 'panel tx-center snd-panel is-empty', 'aria-label': ts.panel.label, hidden: true }, header, body, emptyEl, fileInput);

  // ---- picking audio ----
  let uploadFor: SoundVariant[] = [];
  function upload(targets: SoundVariant[]) {
    uploadFor = targets;
    fileInput.value = '';
    fileInput.click();
  }
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (f) void replaceWith(uploadFor, f, f.name, false);
  });

  async function record(targets: SoundVariant[]) {
    const label = targets.length === 1 ? fileLabel(targets[0]) : fmt(ts.panel.allSounds, { count: targets.length });
    const blob = await openRecorder({ title: ts.panel.recordTitle, subtitle: fmt(ts.panel.recordFor, { name: event?.name ?? ts.panel.thisSound, what: label }) });
    if (blob) await replaceWith(targets, blob, ts.panel.recording, true);
  }

  async function replaceWith(targets: SoundVariant[], blob: Blob, name: string, recorded: boolean) {
    if (!targets.length) return;
    targets.forEach((v) => pending.add(v.stem));
    cards.forEach((c) => c.update());
    try {
      await sounds.replace(targets, blob, name, recorded);
      const what = targets.length === 1 ? fileLabel(targets[0]) : fmt(ts.panel.nSounds, { count: targets.length });
      toast(fmt(ts.panel.isNow, { name: recorded ? ts.panel.recording : name, what }), { tone: 'success', duration: 2600 });
    } catch (err) {
      if (!isAbortError(err)) toast(friendlyError(err), { tone: 'error' });
    } finally {
      targets.forEach((v) => pending.delete(v.stem));
      cards.forEach((c) => c.update());
    }
  }

  function replaceMenu(anchor: HTMLElement, targets: SoundVariant[]) {
    const rec = recordingSupported();
    const items: MenuItem[] = [
      { label: ts.panel.upload, icon: 'upload', onClick: () => upload(targets) },
      { label: rec.ok ? ts.panel.record : ts.panel.recordUnavailable, icon: 'mic', disabled: !rec.ok, onClick: () => void record(targets) },
    ];
    openMenu(anchor, items, { placement: 'bottom-end', label: ts.panel.replaceWith });
  }

  replaceBtn.addEventListener('click', () => {
    if (!event) return;
    replaceMenu(replaceBtn, event.variants);
  });
  tooltip(replaceBtn, ts.panel.replaceAllHint);

  function openMore() {
    if (!event) return;
    const e = event;
    const edited = e.variants.filter((v) => sounds.isVariantEdited(v));
    const items: MenuItem[] = [
      { label: ts.panel.copyName, icon: 'copy', onClick: () => void navigator.clipboard?.writeText(e.id).then(() => toast(ts.panel.copied, { tone: 'success', duration: 1600 })) },
    ];
    if (edited.length) items.push({ label: edited.length === 1 ? ts.panel.resetOne : fmt(ts.panel.resetAll, { count: edited.length }), icon: 'reset', danger: true, onClick: () => sounds.reset(edited) });
    openMenu(moreBtn, items, { placement: 'bottom-end', label: fmt(ts.panel.actions, { name: e.name }) });
  }

  playBtn.addEventListener('click', () => {
    if (!event) return;
    sounds.playEvent(event).catch((err) => toast(friendlyError(err), { tone: 'error' }));
  });

  // ---- cards ----
  const fileLabel = (v: SoundVariant) => {
    const i = event ? event.variants.indexOf(v) : -1;
    return event && event.variants.length > 1 && i >= 0 ? fmt(ts.panel.soundN, { n: i + 1 }) : ts.panel.itsSound;
  };

  function makeCard(v: SoundVariant, index: number): Card {
    const card: Card = { v, el: h('article', { class: 'snd-var', dataset: { stem: v.stem } }), edited: false, source: undefined, wave: null, params: null, samples: null, update, destroy };
    const n = event!.variants.length;
    const title = n > 1 ? fmt(ts.panel.soundTitle, { n: index + 1 }) : ts.panel.sound;
    const packKey = `pack:${v.stem}`;
    const gameKey = `game:${v.stem}`;

    const playBtn = iconButton('play', fmt(ts.panel.playFile, { title: inSentence(title) }), () => playCard(), { class: 'snd-var-play' });
    const gameBtn = button({ label: ts.panel.original, icon: 'play', variant: 'ghost', size: 'sm', class: 'snd-var-game', title: ts.panel.playGame, onClick: () => playGame() });
    const replBtn = button({ label: ts.panel.replace, icon: 'upload', variant: 'ghost', size: 'sm', class: 'snd-var-replace', onClick: () => replaceMenu(replBtn, [v]) });
    tooltip(replBtn, ts.panel.replaceHint);
    const resetBtn = iconButton('reset', ts.panel.resetOne, () => sounds.reset([v]), { size: 'sm', class: 'snd-var-reset' });
    const dlBtn = iconButton('download', ts.panel.download, () => download(), { size: 'sm', class: 'snd-var-dl' });
    const status = h('span', { class: 'snd-var-status', role: 'status', 'aria-live': 'polite' });
    const tags = h('span', { class: 'snd-var-tags' });
    if (v.weight !== undefined && v.weight !== 1) tags.append(h('span', { class: 'snd-tag', title: ts.panel.weightHint }, fmt(ts.panel.weight, { value: String(v.weight) })));
    if (v.volume !== undefined && v.volume !== 1) tags.append(h('span', { class: 'snd-tag', title: ts.panel.volumeHint }, fmt(ts.panel.volume, { value: String(Math.round(v.volume * 100)) })));
    if (v.pitch !== undefined && v.pitch !== 1) tags.append(h('span', { class: 'snd-tag', title: ts.panel.pitchHint }, fmt(ts.panel.pitch, { value: String(v.pitch) })));
    if (v.stream) tags.append(h('span', { class: 'snd-tag', title: ts.panel.streamHint }, ts.panel.stream));
    const editedBadge = badge(ts.panel.replacedBadge, 'green');
    editedBadge.classList.add('snd-var-badge');
    const head = h(
      'div',
      { class: 'snd-var-head' },
      playBtn,
      h('div', { class: 'snd-var-text' }, h('div', { class: 'snd-var-title' }, h('strong', null, title), editedBadge, tags), h('code', { class: 'snd-var-path', title: v.path }, v.name)),
      h('div', { class: 'snd-var-actions' }, status, gameBtn, replBtn, dlBtn, resetBtn),
    );
    const editor = h('div', { class: 'snd-var-editor' });
    const users = (sounds.catalog?.users.get(v.stem) ?? []).filter((id) => id !== event!.id);
    const usersEl = users.length
      ? h(
          'div',
          { class: 'snd-var-users' },
          h('span', { class: 'faint' }, ts.panel.alsoHeardIn),
          ...users.slice(0, 6).map((id) => {
            const other = sounds.catalog?.byId.get(id);
            const chip = h('button', { type: 'button', class: 'chip snd-user-chip' }, other?.name ?? id);
            tooltip(chip, id);
            chip.addEventListener('click', () => other && opts.onPick(other));
            return chip;
          }),
          users.length > 6 ? h('span', { class: 'faint' }, fmt(ts.panel.moreCount, { count: users.length - 6 })) : null,
        )
      : null;
    card.el.append(head, editor, usersEl ?? '');

    // drop a file on the card to replace it
    card.el.addEventListener('dragover', (e) => {
      if (!e.dataTransfer?.types.includes('Files')) return;
      e.preventDefault();
      card.el.classList.add('is-drop');
    });
    card.el.addEventListener('dragleave', (e) => {
      if (!card.el.contains(e.relatedTarget as Node)) card.el.classList.remove('is-drop');
    });
    card.el.addEventListener('drop', (e) => {
      e.preventDefault();
      card.el.classList.remove('is-drop');
      const f = e.dataTransfer?.files?.[0];
      if (f) void replaceWith([v], f, f.name, false);
    });

    function playCard() {
      if (sounds.player.key === packKey) return sounds.player.stop();
      if (card.samples && card.params) {
        const p = clampParams(card.params, card.samples.duration);
        sounds.player.playSamples(packKey, card.samples, { start: p.start, end: p.end, gain: p.gain, mono: !p.stereo });
        return;
      }
      sounds.play(v, packKey).catch((err) => toast(friendlyError(err), { tone: 'error' }));
    }
    function playGame() {
      sounds.playGame(v, gameKey).catch((err) => toast(friendlyError(err), { tone: 'error' }));
    }
    function download() {
      const f = sounds.fileOf(v);
      if (f) saveBlob(f.blob, f.path.slice(f.path.lastIndexOf('/') + 1));
    }

    let building = 0;
    async function buildEditor() {
      const my = ++building;
      card.wave?.destroy();
      card.wave = null;
      card.samples = null;
      card.params = null;
      editor.replaceChildren(h('div', { class: 'snd-var-loading' }, spinner(20), h('span', { class: 'muted' }, ts.panel.reading)));
      let s: Samples | null = null;
      try {
        s = await sounds.sourceOf(v);
      } catch (err) {
        if (my !== building) return;
        editor.replaceChildren(h('p', { class: 'snd-var-note is-warn' }, icon('warning'), fmt(ts.panel.cantEdit, { error: friendlyError(err) })));
        return;
      }
      if (my !== building || !s) return;
      const edit = sounds.editOf(v);
      const params = clampParams(edit ? { start: edit.start, end: edit.end, gain: edit.gain, stereo: edit.stereo } : { start: 0, end: s.duration, gain: 1, stereo: s.channels.length > 1 }, s.duration);
      card.samples = s;
      card.params = params;
      const samples = s;
      const commit = (p: Partial<RenderParams>) => {
        Object.assign(card.params!, p);
        paintInfo();
        sounds.update(v, p).catch((err) => toast(friendlyError(err), { tone: 'error' }));
      };
      const wave = createWaveform({
        label: title,
        onInput: (a, b) => {
          card.params!.start = a;
          card.params!.end = b;
          paintInfo();
        },
        onCommit: (a, b) => commit({ start: a, end: b }),
      });
      card.wave = wave;
      wave.set(samples, params.start, params.end, params.gain);
      const vol = slider({
        label: ts.panel.volumeLabel,
        min: 0,
        max: 200,
        step: 1,
        unit: '%',
        value: Math.round(params.gain * 100),
        onInput: (x) => {
          card.params!.gain = x / 100;
          wave.setGain(card.params!.gain);
          paintInfo();
        },
        onChange: (x) => commit({ gain: x / 100 }),
      });
      vol.classList.add('snd-vol');
      const normBtn = button({
        label: ts.panel.normalise,
        icon: 'volume-2',
        size: 'sm',
        variant: 'ghost',
        title: ts.panel.normaliseHint,
        onClick: () => {
          const g = normaliseGain(samples.channels, samples.sampleRate, card.params!.start, card.params!.end);
          vol.setValue(Math.round(g * 100));
          wave.setGain(g);
          commit({ gain: g });
        },
      });
      const trimBtn = button({
        label: ts.panel.trim,
        icon: 'scissors',
        size: 'sm',
        variant: 'ghost',
        title: ts.panel.trimHint,
        onClick: () => {
          const r = soundRange(samples.channels, samples.sampleRate);
          wave.setRange(r.start, r.end);
          commit(r);
        },
      });
      const fullBtn = button({
        label: ts.panel.whole,
        icon: 'arrows-horizontal',
        size: 'sm',
        variant: 'ghost',
        title: ts.panel.wholeHint,
        onClick: () => {
          wave.setRange(0, samples.duration);
          commit({ start: 0, end: samples.duration });
        },
      });
      const stereo =
        samples.channels.length > 1
          ? toggle({
              label: ts.panel.stereo,
              value: params.stereo,
              description: ts.panel.stereoHint,
              onChange: (on) => commit({ stereo: on }),
            })
          : null;
      const info = h('p', { class: 'snd-var-info' });
      const clip = h('p', { class: 'snd-var-note is-warn', hidden: true }, icon('warning'), ts.panel.tooLoud);
      function paintInfo() {
        const p = card.params!;
        const f = sounds.fileOf(v);
        const ed = sounds.editOf(v);
        const ch = p.stereo && samples.channels.length > 1 ? ts.panel.stereoInfo : ts.panel.mono;
        const parts = [
          h('span', null, fmt(ts.panel.seconds, { value: decimal(p.end - p.start, 2) })),
          h('span', null, ch),
          h('span', null, fmt(ts.panel.khz, { value: decimal(samples.sampleRate / 1000, 1) })),
        ];
        if (f) parts.push(h('span', null, `${formatBytes(f.blob.size)} ${/\.ogg$/i.test(f.path) ? 'Ogg Vorbis' : f.path.slice(f.path.lastIndexOf('.') + 1).toUpperCase()}`));
        if (ed?.sourceName) parts.push(h('span', { class: 'truncate', title: ed.sourceName }, fmt(ts.panel.from, { name: ed.sourceName })));
        info.replaceChildren(...parts);
        clip.hidden = peakOf(samples.channels, samples.sampleRate, p.start, p.end) * p.gain <= 1.0001;
      }
      paintInfo();
      card.update = () => {
        update();
        if (card.samples && card.params && !sounds.isBusy(v)) {
          const ed = sounds.editOf(v);
          if (ed && (ed.start !== card.params.start || ed.end !== card.params.end || ed.gain !== card.params.gain)) {
            Object.assign(card.params, clampParams(ed, samples.duration));
            wave.setRange(card.params.start, card.params.end);
            wave.setGain(card.params.gain);
            vol.setValue(Math.round(card.params.gain * 100));
          }
          paintInfo();
        }
      };
      editor.replaceChildren(
        wave.el,
        h('div', { class: 'snd-var-controls' }, vol, h('div', { class: 'snd-var-tools' }, normBtn, trimBtn, fullBtn)),
        stereo ?? '',
        clip,
        info,
      );
    }

    function update() {
      const edited = sounds.isVariantEdited(v);
      const busy = sounds.isBusy(v) || pending.has(v.stem);
      const src = sounds.editOf(v)?.source;
      card.el.classList.toggle('is-edited', edited);
      card.el.classList.toggle('is-busy', busy);
      editedBadge.hidden = !edited;
      resetBtn.hidden = !edited;
      dlBtn.hidden = !edited;
      gameBtn.hidden = !edited;
      gameBtn.disabled = !sounds.hasGameSound(v);
      status.replaceChildren(...(busy ? [spinner(16), h('span', null, ts.panel.saving)] : []));
      const playing = sounds.player.key === packKey;
      playBtn.setIcon(playing ? 'stop' : 'play');
      playBtn.setAttribute('aria-label', fmt(playing ? ts.panel.stopFile : ts.panel.playFile, { title: inSentence(title) }));
      playBtn.disabled = !edited && !sounds.hasGameSound(v);
      const gIcon = gameBtn.querySelector<HTMLElement>('.icon');
      if (gIcon) setIcon(gIcon, sounds.player.key === gameKey ? 'stop' : 'play');
      if (edited !== card.edited || src !== card.source) {
        card.edited = edited;
        card.source = src;
        if (edited) void buildEditor();
        else {
          building++;
          card.wave?.destroy();
          card.wave = null;
          card.samples = null;
          card.params = null;
          editor.replaceChildren();
        }
      }
    }
    function destroy() {
      building++;
      card.wave?.destroy();
    }
    update();
    return card;
  }

  // ---- event ----
  function render() {
    cards.forEach((c) => c.destroy());
    cards = [];
    el.classList.toggle('is-empty', !event);
    if (!event) {
      headTitle.textContent = ts.panel.sounds;
      headSub.textContent = '';
      headBadges.replaceChildren();
      varsEl.replaceChildren();
      return;
    }
    const e = event;
    setIcon(headIcon.querySelector('.icon') as HTMLElement, SOUND_CATEGORY_ICONS[e.category]);
    headTitle.textContent = e.name;
    headTitle.title = e.name;
    const n = e.variants.length;
    headSub.textContent = `${e.id} · ${fmt(ts.panel.count, { count: n })}`;
    paintBadges();
    replaceBtn.querySelector('.btn-label')!.textContent = n > 1 ? ts.panel.replaceAll : ts.panel.replace;
    const java = sounds.store.assets.edition === 'java';
    intro.textContent =
      (n > 1 ? ts.panel.random : '') + (java ? ts.panel.javaOgg : ts.panel.bedrockOgg);
    cards = e.variants.map((v, i) => makeCard(v, i));
    varsEl.replaceChildren(...cards.map((c) => c.el));
    if (e.refs?.length) {
      refsEl.hidden = false;
      refsEl.replaceChildren(
        h('span', { class: 'faint' }, ts.panel.alsoPlays),
        ...e.refs.map((id) => {
          const other = sounds.catalog?.byId.get(id);
          const chip = h('button', { type: 'button', class: 'chip snd-user-chip' }, other?.name ?? id);
          chip.disabled = !other;
          chip.addEventListener('click', () => other && opts.onPick(other));
          return chip;
        }),
      );
    } else refsEl.hidden = true;
    body.scrollTop = 0;
  }

  function paintBadges() {
    if (!event) return;
    const b = [badge(ts.categories[event.category], 'gray')];
    if (sounds.isEdited(event)) b.unshift(badge(ts.panel.replacedBadge, 'green'));
    headBadges.replaceChildren(...b);
  }

  function paintPlay() {
    const playing = !!event && sounds.player.key === `event:${event.id}`;
    setIcon(playBtn.querySelector('.icon') as HTMLElement, playing ? 'stop' : 'play');
    playBtn.querySelector('.btn-label')!.textContent = playing ? ts.panel.stop : ts.panel.play;
  }

  // playhead on the waveform of the file playing
  let raf = 0;
  const tickHead = () => {
    raf = 0;
    const key = sounds.player.key;
    let any = false;
    for (const c of cards) {
      if (!c.wave) continue;
      if (key === `pack:${c.v.stem}`) {
        c.wave.setPlayhead(sounds.player.position());
        any = true;
      } else c.wave.setPlayhead(null);
    }
    if (any) raf = requestAnimationFrame(tickHead);
  };

  cleanups.push(
    sounds.events.on('edited', (stem) => {
      for (const c of cards) if (stem === null || c.v.stem === stem) c.update();
      paintBadges();
    }),
    sounds.events.on('busy', ({ stem }) => {
      for (const c of cards) if (c.v.stem === stem) c.update();
    }),
    sounds.events.on('status', () => {
      if (event && sounds.catalog) {
        const fresh = sounds.catalog.byId.get(event.id) ?? null;
        if (fresh !== event) {
          event = fresh;
          render();
        }
      }
    }),
    sounds.player.events.on('change', () => {
      paintPlay();
      for (const c of cards) c.update();
      if (!raf) raf = requestAnimationFrame(tickHead);
    }),
  );

  return {
    el,
    show(e) {
      if (e === event) return;
      event = e;
      sounds.player.stop();
      render();
      paintPlay();
    },
    current: () => event,
    destroy() {
      cleanups.forEach((f) => f());
      cards.forEach((c) => c.destroy());
      if (raf) cancelAnimationFrame(raf);
    },
  };
}
