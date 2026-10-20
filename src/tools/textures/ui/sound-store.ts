// Sound editing state for one texture pack: the game's sound list (loaded the first time Sounds is
// opened), which sounds the pack replaces, playback, and turning uploads / recordings into the
// pack's Ogg Vorbis files (saved with the project through the texture store).

import type { SoundEdit } from '../../../core/types';
import { Emitter } from '../../../core/events';
import { friendlyError, isAbortError } from '../../../core/net';
import type { TexStore } from './store';
import type { SoundCatalog, SoundCategory, SoundEvent, SoundVariant } from '../sounds/catalog';
import { definitionsForStem, editedSoundStems, removeSoundFile, setSoundFile, soundFileOf } from '../sounds/pack';
import { SoundsUnsupportedError, fetchBedrockSound, javaSoundUrl, loadVanillaSounds, type VanillaSounds } from '../sounds/vanilla';
import { SoundPlayer, decodeAudioFile, samplesFrom, type Samples } from '../sounds/audio';
import { decodeFsb5, isFsb5 } from '../sounds/fsb';
import { clampParams, normaliseGain, renderSamples, soundRange, type RenderParams } from '../sounds/render';
import { encodeOggVorbis } from '../sounds/encode';
import { ts } from './i18n/sounds';

export type SoundStatus = 'idle' | 'loading' | 'ready' | 'error' | 'unsupported';

export interface SoundStateEvents extends Record<string, unknown> {
  status: SoundStatus;
  /** A file of the pack changed (stem), or null for many at once */
  edited: string | null;
  /** Saving a file started / finished */
  busy: { stem: string; busy: boolean };
}

/** Uploads larger than this aren't kept for re-trimming (the saved Ogg is edited instead). */
const MAX_SOURCE_BYTES = 40 * 1024 * 1024;
const MAX_SECONDS = 15 * 60;
/** Categories where two channels make sense (the game plays stereo sounds without a direction). */
const STEREO_CATEGORIES = new Set<SoundCategory>(['music', 'records', 'ui']);

export class SoundState {
  readonly events = new Emitter<SoundStateEvents>();
  readonly player = new SoundPlayer();
  status: SoundStatus = 'idle';
  error = '';
  vanilla: VanillaSounds | null = null;
  /** Stems of the sound files the pack has */
  stems: Set<string>;

  private loading: Promise<void> | null = null;
  private controller = new AbortController();
  private decoded = new WeakMap<Blob, Promise<Samples>>();
  private gameAudio = new Map<string, Promise<Samples | null>>();
  private seq = new Map<string, number>();
  private busyStems = new Set<string>();

  constructor(readonly store: TexStore) {
    this.stems = editedSoundStems(store.project);
  }

  get project() {
    return this.store.project;
  }

  get catalog(): SoundCatalog | null {
    return this.vanilla?.catalog ?? null;
  }

  /** Loads the game's sound list once (call again after an error to retry). */
  load(): Promise<void> {
    if (this.status === 'ready' || this.status === 'unsupported') return Promise.resolve();
    if (this.loading) return this.loading;
    this.setStatus('loading');
    this.loading = loadVanillaSounds(this.store.assets, { signal: this.controller.signal })
      .then((v) => {
        this.vanilla = v;
        this.setStatus('ready');
      })
      .catch((err) => {
        if (isAbortError(err)) return;
        console.error(err);
        this.error = friendlyError(err);
        this.setStatus(err instanceof SoundsUnsupportedError ? 'unsupported' : 'error');
      })
      .finally(() => {
        this.loading = null;
      });
    return this.loading;
  }

  private setStatus(s: SoundStatus): void {
    this.status = s;
    this.events.emit('status', s);
  }

  // ---- edited state ----

  isEdited(e: SoundEvent): boolean {
    return e.variants.some((v) => this.stems.has(v.stem));
  }

  isVariantEdited(v: SoundVariant): boolean {
    return this.stems.has(v.stem);
  }

  editedEventCount(): number {
    const cat = this.catalog;
    if (!cat) return 0;
    let n = 0;
    for (const e of cat.events) if (this.isEdited(e)) n++;
    return n;
  }

  fileOf(v: SoundVariant): { path: string; blob: Blob } | null {
    return soundFileOf(this.project, v.stem);
  }

  editOf(v: SoundVariant): SoundEdit | undefined {
    const f = this.fileOf(v);
    return f ? this.project.sounds?.[f.path] : undefined;
  }

  isBusy(v: SoundVariant): boolean {
    return this.busyStems.has(v.stem);
  }

  /** Re-reads which files the pack has (after an outside change, e.g. reloading). */
  refresh(): void {
    this.stems = editedSoundStems(this.project);
    this.events.emit('edited', null);
  }

  // ---- audio ----

  private decodeBlob(blob: Blob, nameHint = ''): Promise<Samples> {
    let p = this.decoded.get(blob);
    if (!p) {
      p = (async () => {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (isFsb5(bytes) || /\.fsb$/i.test(nameHint)) return samplesFrom(decodeFsb5(bytes));
        return decodeAudioFile(bytes);
      })();
      this.decoded.set(blob, p);
      p.catch(() => this.decoded.delete(blob));
    }
    return p;
  }

  /** The samples an edited file is made from: the kept upload, else the pack's own file. */
  async sourceOf(v: SoundVariant): Promise<Samples | null> {
    const file = this.fileOf(v);
    if (!file) return null;
    const edit = this.project.sounds?.[file.path];
    if (edit?.source) return this.decodeBlob(edit.source, edit.sourceName);
    return this.decodeBlob(file.blob, file.path);
  }

  /** Bedrock: the game's sound, decoded (null when bedrock-samples doesn't have it). */
  private gameSamples(v: SoundVariant): Promise<Samples | null> {
    const ref = this.vanilla?.ref;
    if (!ref) return Promise.resolve(null);
    let p = this.gameAudio.get(v.stem);
    if (!p) {
      p = fetchBedrockSound(ref, v.stem, this.controller.signal).then((f) => (f ? (f.ext === 'fsb' ? samplesFrom(decodeFsb5(f.bytes)) : decodeAudioFile(f.bytes)) : null));
      this.gameAudio.set(v.stem, p);
      p.catch(() => this.gameAudio.delete(v.stem));
      if (this.gameAudio.size > 40) this.gameAudio.delete(this.gameAudio.keys().next().value!);
    }
    return p;
  }

  /** True when the game's version of a file can be played here. */
  hasGameSound(v: SoundVariant): boolean {
    if (this.store.assets.edition === 'java') return !!this.vanilla?.hashes?.get(v.stem);
    return !!this.vanilla?.ref;
  }

  /** Plays the game's version of a file. */
  async playGame(v: SoundVariant, key = `game:${v.stem}`): Promise<void> {
    if (this.player.key === key) return this.player.stop();
    if (this.store.assets.edition === 'java') {
      const hash = this.vanilla?.hashes?.get(v.stem);
      if (!hash) throw new Error(ts.errors.notInGame);
      return this.player.playUrl(key, javaSoundUrl(hash), Math.min(1, v.volume ?? 1));
    }
    this.player.stop();
    const s = await this.gameSamples(v);
    if (!s) throw new Error(ts.errors.noSample);
    this.player.playSamples(key, s, { gain: Math.min(1, v.volume ?? 1) });
  }

  /** Plays the pack's version of a file (as it will sound in game), else the game's. */
  async play(v: SoundVariant, key = `pack:${v.stem}`): Promise<void> {
    if (this.player.key === key) return this.player.stop();
    const file = this.fileOf(v);
    if (!file) return this.playGame(v, key);
    this.player.stop();
    const edit = this.project.sounds?.[file.path];
    if (edit?.source) {
      const s = await this.decodeBlob(edit.source, edit.sourceName);
      const p = clampParams(edit, s.duration);
      this.player.playSamples(key, s, { start: p.start, end: p.end, gain: p.gain, mono: !p.stereo });
      return;
    }
    const s = await this.decodeBlob(file.blob, file.path);
    this.player.playSamples(key, s);
  }

  /** Plays one of the event's files, picked by weight like the game does. */
  playEvent(e: SoundEvent): Promise<void> {
    const key = `event:${e.id}`;
    if (this.player.key === key) {
      this.player.stop();
      return Promise.resolve();
    }
    const total = e.variants.reduce((s, v) => s + (v.weight ?? 1), 0);
    let r = Math.random() * total;
    const v = e.variants.find((x) => (r -= x.weight ?? 1) < 0) ?? e.variants[0];
    return this.play(v, key);
  }

  // ---- edits ----

  /** Default trim / volume / channels for newly picked audio. */
  defaults(v: SoundVariant, s: Samples, recorded: boolean): RenderParams {
    const event = this.catalog?.byId.get(this.catalog.users.get(v.stem)?.[0] ?? '');
    const stereo = s.channels.length > 1 && !!event && STEREO_CATEGORIES.has(event.category);
    if (!recorded) return { start: 0, end: s.duration, gain: 1, stereo };
    // Recordings: cut the silence around the sound and bring it to a good level.
    const r = soundRange(s.channels, s.sampleRate);
    return { ...r, gain: Math.max(1, normaliseGain(s.channels, s.sampleRate, r.start, r.end)), stereo };
  }

  /** Replaces files with an upload or a recording. */
  async replace(variants: SoundVariant[], blob: Blob, name: string, recorded = false): Promise<void> {
    if (!variants.length) return;
    const s = await decodeAudioFile(blob);
    if (s.duration > MAX_SECONDS) throw new Error(ts.errors.tooLong);
    const keep = blob.size <= MAX_SOURCE_BYTES ? blob : undefined;
    if (keep) this.decoded.set(keep, Promise.resolve(s));
    await Promise.all(
      variants.map((v) => {
        const p = this.defaults(v, s, recorded);
        return this.commit(v, s, { source: keep, sourceName: name, ...p, updatedAt: Date.now() });
      }),
    );
  }

  /** New trim / volume / channels for an edited file. */
  async update(v: SoundVariant, params: Partial<RenderParams>): Promise<void> {
    const file = this.fileOf(v);
    if (!file) return;
    const old = this.project.sounds?.[file.path];
    const s = await this.sourceOf(v);
    if (!s) return;
    const base: RenderParams = old ? { start: old.start, end: old.end, gain: old.gain, stereo: old.stereo } : { start: 0, end: s.duration, gain: 1, stereo: s.channels.length > 1 };
    const next = clampParams({ ...base, ...params }, s.duration);
    // An opened pack's own file becomes the source, so trims don't stack up.
    const source = old?.source ?? (old ? undefined : file.blob);
    await this.commit(v, s, { ...old, source, sourceName: old?.sourceName ?? file.path.slice(file.path.lastIndexOf('/') + 1), ...next, updatedAt: Date.now() });
  }

  private async commit(v: SoundVariant, s: Samples, edit: SoundEdit): Promise<void> {
    const n = (this.seq.get(v.stem) ?? 0) + 1;
    this.seq.set(v.stem, n);
    this.setBusy(v.stem, true);
    try {
      const p = clampParams(edit, s.duration);
      const bytes = await encodeOggVorbis(renderSamples(s.channels, s.sampleRate, p), s.sampleRate);
      if (this.seq.get(v.stem) !== n) return; // a newer edit (or a reset) came in meanwhile
      const saved: SoundEdit = { ...edit, ...p };
      if (!saved.source) {
        // Nothing to trim from later: the saved file is the new starting point.
        const len = Math.round(p.end * s.sampleRate) - Math.round(p.start * s.sampleRate);
        Object.assign(saved, { start: 0, end: len / s.sampleRate, gain: 1 });
      }
      const cat = this.catalog;
      if (cat?.edition === 'bedrock') {
        const defs = definitionsForStem(cat, v.stem);
        if (defs) saved.definitions = defs;
        else delete saved.definitions;
      } else delete saved.definitions;
      if (saved.sourceName === undefined) delete saved.sourceName;
      if (saved.source === undefined) delete saved.source;
      setSoundFile(this.project, v.stem, new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'audio/ogg' }), saved);
      this.stems.add(v.stem);
      this.store.touch();
      this.events.emit('edited', v.stem);
    } finally {
      if (this.seq.get(v.stem) === n) this.setBusy(v.stem, false);
    }
  }

  /** Back to the game's sound. */
  reset(variants: SoundVariant[]): void {
    let changed = false;
    for (const v of variants) {
      this.seq.set(v.stem, (this.seq.get(v.stem) ?? 0) + 1);
      this.setBusy(v.stem, false);
      if (removeSoundFile(this.project, v.stem)) changed = true;
      this.stems.delete(v.stem);
      this.events.emit('edited', v.stem);
    }
    if (this.player.key && variants.some((v) => this.player.key!.endsWith(v.stem))) this.player.stop();
    if (changed) this.store.touch();
  }

  private setBusy(stem: string, busy: boolean): void {
    if (busy === this.busyStems.has(stem)) return;
    if (busy) this.busyStems.add(stem);
    else this.busyStems.delete(stem);
    this.events.emit('busy', { stem, busy });
  }

  dispose(): void {
    this.controller.abort();
    this.player.dispose();
    this.events.clear();
  }
}
