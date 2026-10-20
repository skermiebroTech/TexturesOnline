// Record a sound with the microphone: asks for access only when Record is pressed, explains what to
// do when it's blocked or missing, shows a level meter and timer, and hands back the recording.

import { h } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { button, spinner } from '../../../ui/components';
import { openModal } from '../../../ui/modal';

const MAX_SECONDS = 5 * 60;
const TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];

export function recordingSupported(): { ok: boolean; reason?: string } {
  if (typeof window === 'undefined' || !window.isSecureContext) return { ok: false, reason: 'Recording needs a secure page (https).' };
  if (!navigator.mediaDevices?.getUserMedia) return { ok: false, reason: 'This browser can’t use a microphone.' };
  if (typeof MediaRecorder === 'undefined') return { ok: false, reason: 'This browser can’t record audio. Try Chrome, Edge, Firefox or Safari.' };
  return { ok: true };
}

function micError(err: unknown): string {
  const name = err instanceof DOMException || err instanceof Error ? err.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone access is blocked. Allow it for this site (the microphone or padlock icon in the address bar, or your browser’s site settings), then try again.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No microphone was found. Plug one in, or pick an input in your system’s sound settings, then try again.';
    case 'NotReadableError':
    case 'AbortError':
      return 'The microphone is busy or couldn’t start. Close other apps that use it and try again.';
    default:
      return 'The microphone couldn’t be started. Check that one is connected and try again.';
  }
}

/** Opens the recorder; resolves with the recording, or null when cancelled. */
export function openRecorder(opts: { title: string; subtitle?: string }): Promise<Blob | null> {
  return new Promise((resolve) => {
    let stream: MediaStream | null = null;
    let recorder: MediaRecorder | null = null;
    let ctx: AudioContext | null = null;
    let raf = 0;
    let tick: ReturnType<typeof setInterval> | null = null;
    let settled = false;
    let chunks: Blob[] = [];

    const status = h('p', { class: 'snd-rec-status', role: 'status', 'aria-live': 'polite' });
    const timer = h('span', { class: 'snd-rec-time' }, '0:00');
    const meterFill = h('span', { class: 'snd-rec-meter-fill' });
    const meter = h('span', { class: 'snd-rec-meter', role: 'meter', 'aria-label': 'Microphone level', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, meterFill);
    const dot = h('span', { class: 'snd-rec-dot', 'aria-hidden': 'true' });
    const live = h('div', { class: 'snd-rec-live', hidden: true }, dot, timer, meter);
    const startBtn = button({ label: 'Start recording', icon: 'mic', variant: 'primary', class: 'snd-rec-start' });
    const stopBtn = button({ label: 'Stop', icon: 'stop', variant: 'primary', class: 'snd-rec-stop' });
    stopBtn.hidden = true;
    const body = h(
      'div',
      { class: 'snd-rec' },
      opts.subtitle ? h('p', { class: 'muted snd-rec-sub' }, opts.subtitle) : null,
      h('div', { class: 'snd-rec-stage' }, h('span', { class: 'snd-rec-icon', 'aria-hidden': 'true' }, icon('mic', { size: 48 })), live, status),
      h('div', { class: 'snd-rec-actions' }, startBtn, stopBtn),
      h('p', { class: 'faint small snd-rec-note' }, 'The recording stays on this device. It’s trimmed and levelled for you; you can change both afterwards.'),
    );

    const modal = openModal({
      title: opts.title,
      body,
      width: 460,
      class: 'snd-rec-modal',
      initialFocus: startBtn,
      onClose: () => finish(null),
    });

    const supported = recordingSupported();
    if (!supported.ok) {
      status.textContent = supported.reason!;
      status.classList.add('is-error');
      startBtn.disabled = true;
    } else status.textContent = 'Press Start, then allow the microphone if your browser asks.';

    function cleanup() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (tick) clearInterval(tick);
      tick = null;
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      void ctx?.close().catch(() => undefined);
      ctx = null;
    }

    function finish(blob: Blob | null) {
      if (settled) return;
      settled = true;
      if (recorder && recorder.state !== 'inactive') {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        try {
          recorder.stop();
        } catch {
          /* already stopped */
        }
      }
      cleanup();
      resolve(blob);
    }

    startBtn.addEventListener('click', async () => {
      startBtn.disabled = true;
      status.classList.remove('is-error');
      status.replaceChildren(spinner(16), ' Waiting for microphone access…');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: false } });
      } catch (err) {
        status.textContent = micError(err);
        status.classList.add('is-error');
        startBtn.disabled = false;
        startBtn.querySelector('.btn-label')!.textContent = 'Try again';
        return;
      }
      if (settled) return cleanup();
      const type = TYPES.find((t) => MediaRecorder.isTypeSupported?.(t));
      try {
        recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      } catch {
        status.textContent = 'This browser can’t record audio.';
        status.classList.add('is-error');
        cleanup();
        return;
      }
      chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder?.mimeType || type || 'audio/webm' });
        if (!blob.size) {
          status.textContent = 'Nothing was recorded. Try again.';
          status.classList.add('is-error');
          cleanup();
          return;
        }
        finish(blob);
        modal.close();
      };
      recorder.start(250);
      // level meter
      try {
        ctx = new AudioContext();
        const an = ctx.createAnalyser();
        an.fftSize = 1024;
        ctx.createMediaStreamSource(stream).connect(an);
        const buf = new Float32Array(an.fftSize);
        const loop = () => {
          an.getFloatTimeDomainData(buf);
          let peak = 0;
          for (const v of buf) peak = Math.max(peak, Math.abs(v));
          const pct = Math.round(Math.min(1, Math.sqrt(peak)) * 100);
          meterFill.style.width = `${pct}%`;
          meter.setAttribute('aria-valuenow', String(pct));
          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch {
        meter.hidden = true;
      }
      const t0 = Date.now();
      tick = setInterval(() => {
        const s = Math.floor((Date.now() - t0) / 1000);
        timer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        if (s >= MAX_SECONDS) stopBtn.click();
      }, 250);
      body.classList.add('is-recording');
      live.hidden = false;
      startBtn.hidden = true;
      stopBtn.hidden = false;
      stopBtn.focus();
      status.textContent = 'Recording… press Stop when you’re done.';
    });

    stopBtn.addEventListener('click', () => {
      stopBtn.disabled = true;
      status.replaceChildren(spinner(16), ' Finishing…');
      if (recorder && recorder.state !== 'inactive') recorder.stop();
    });
  });
}
