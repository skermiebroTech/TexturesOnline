// Browser audio: decoding picked files, and one player for the whole editor (starting a sound stops
// the one before). Sounds with samples play through Web Audio; vanilla Java sounds, which scripts
// can't read (no CORS on Mojang's server), play through an <audio> element.

import { Emitter } from '../../../core/events';
import { SOUND_RATE } from './render';
import type { DecodedAudio } from './fsb';
import { ts } from '../ui/i18n/sounds';

export interface Samples {
  sampleRate: number;
  channels: Float32Array[];
  duration: number;
}

type Ctor = typeof AudioContext;
const AudioCtx: Ctor | undefined = typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext) : undefined;

export function audioSupported(): boolean {
  return !!AudioCtx && typeof OfflineAudioContext !== 'undefined';
}

/**
 * Decodes any audio file the browser understands (MP3, WAV, Ogg, FLAC, M4A/AAC, WebM...) to
 * SOUND_RATE samples, keeping up to two channels.
 */
export async function decodeAudioFile(data: Blob | ArrayBuffer | Uint8Array): Promise<Samples> {
  if (!audioSupported()) throw new Error(ts.errors.noAudio);
  const buf = data instanceof Blob ? await data.arrayBuffer() : data instanceof Uint8Array ? data.slice().buffer : data.slice(0);
  if (!buf.byteLength) throw new Error(ts.errors.empty);
  const ctx = new OfflineAudioContext(1, 1, SOUND_RATE);
  let audio: AudioBuffer;
  try {
    audio = await ctx.decodeAudioData(buf);
  } catch {
    throw new Error(ts.errors.unreadable);
  }
  if (!audio.length) throw new Error(ts.errors.silent);
  const channels = [audio.getChannelData(0)];
  if (audio.numberOfChannels > 1) channels.push(audio.getChannelData(1));
  return { sampleRate: audio.sampleRate, channels, duration: audio.length / audio.sampleRate };
}

export function samplesFrom(d: DecodedAudio): Samples {
  return { sampleRate: d.sampleRate, channels: d.channels.slice(0, 2), duration: (d.channels[0]?.length ?? 0) / d.sampleRate };
}

// ---------------------------------------------------------------------------------------------
// Player

export interface PlayOptions {
  /** Seconds into the samples */
  start?: number;
  end?: number;
  gain?: number;
  /** Mix to mono (how the game plays positional sounds) */
  mono?: boolean;
}

export interface PlayerEvents extends Record<string, unknown> {
  /** key of the sound now playing, or null */
  change: string | null;
}

export class SoundPlayer {
  readonly events = new Emitter<PlayerEvents>();
  key: string | null = null;
  private ctx: AudioContext | null = null;
  private node: AudioBufferSourceNode | null = null;
  private el: HTMLAudioElement | null = null;
  private startedAt = 0;
  private from = 0;
  private length = 0;

  private context(): AudioContext {
    if (!AudioCtx) throw new Error(ts.errors.noPlayback);
    this.ctx ??= new AudioCtx();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Where the current sound is, as seconds into its samples (for a playhead), or null. */
  position(): number | null {
    if (!this.key) return null;
    if (this.el) return this.el.currentTime;
    if (!this.ctx || !this.node) return null;
    return this.from + Math.min(this.length, this.ctx.currentTime - this.startedAt);
  }

  playSamples(key: string, s: Samples, opts: PlayOptions = {}): void {
    this.stop();
    const ctx = this.context();
    const channels = opts.mono && s.channels.length > 1 ? 1 : s.channels.length;
    const buffer = ctx.createBuffer(channels, s.channels[0].length, s.sampleRate);
    if (channels === 1 && s.channels.length > 1) {
      const out = buffer.getChannelData(0);
      const [a, b] = s.channels;
      for (let i = 0; i < out.length; i++) out[i] = (a[i] + b[i]) / 2;
    } else s.channels.slice(0, channels).forEach((c, i) => buffer.copyToChannel(c as Float32Array<ArrayBuffer>, i));
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = Math.max(0, opts.gain ?? 1);
    src.connect(gain).connect(ctx.destination);
    const from = Math.max(0, Math.min(opts.start ?? 0, s.duration));
    const to = Math.max(from, Math.min(opts.end ?? s.duration, s.duration));
    this.from = from;
    this.length = to - from;
    this.startedAt = ctx.currentTime;
    src.start(0, from, this.length);
    src.onended = () => {
      if (this.node === src) this.finish();
    };
    this.node = src;
    this.setKey(key);
  }

  /** Plays a sound file by URL (vanilla Java sounds). Rejects when it can't be loaded. */
  playUrl(key: string, url: string, gain = 1): Promise<void> {
    this.stop();
    const el = new Audio();
    el.preload = 'auto';
    el.volume = Math.max(0, Math.min(1, gain));
    this.el = el;
    this.setKey(key);
    return new Promise<void>((resolve, reject) => {
      const fail = () => {
        if (this.el === el) this.finish();
        reject(new Error(navigator.onLine === false ? ts.errors.offline : ts.errors.loadFailed));
      };
      el.onended = () => {
        if (this.el === el) this.finish();
      };
      el.onerror = fail;
      el.src = url;
      el.play().then(resolve, (err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return resolve();
        fail();
      });
    });
  }

  stop(): void {
    if (this.node) {
      const n = this.node;
      this.node = null;
      n.onended = null;
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
    }
    if (this.el) {
      const el = this.el;
      this.el = null;
      el.onended = null;
      el.onerror = null;
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
    if (this.key !== null) this.setKey(null);
  }

  private finish(): void {
    this.node = null;
    this.el = null;
    this.setKey(null);
  }

  private setKey(k: string | null): void {
    if (this.key === k) return;
    this.key = k;
    this.events.emit('change', k);
  }

  dispose(): void {
    this.stop();
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.events.clear();
  }
}
