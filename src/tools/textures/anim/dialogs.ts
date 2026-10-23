// Windows of the animation maker (loaded when one first opens): the timing (speed in ticks, each
// frame's time, blending and the play order, with a preview at game speed), importing frames from a
// GIF, a sprite sheet or several pictures, and saving the animation as a GIF to share.

import './anim.css';
import type { TextureAnimation } from '../../../core/types';
import { createImageData, decodeImage, resizeNearest } from '../../../core/image';
import { saveBlob } from '../../../core/download';
import { h, uid } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { segmented, spinner, toggle } from '../../../ui/components';
import { dropzone } from '../../../ui/dropzone';
import { openModal } from '../../../ui/modal';
import { toast } from '../../../ui/toast';
import { fmt, num } from '../../../i18n/editor-text';
import { paintCanvas } from '../ui/thumbs';
import { byPointer } from '../ui/media';
import { ta } from './i18n/text';
import { decodeGif, encodeGif, isGif } from './gif';
import { fitFrame, sliceSheet } from './frames';
import { createPlayer, gifFrames, type PlaySource } from './player';
import { clampTicks, formatOrder, frameTime, gifDelayToTicks, loopTicks, normalizeFrames, parseOrder, playSteps, ticksToSeconds, withFrameTime, MAX_TICKS } from './timing';

/** Seconds as the windows show them: 0.25 -> "0.25", 1.5 -> "1.5" */
const secs = (ticks: number) => num(Math.round(ticksToSeconds(ticks) * 100) / 100);

/** A canvas showing an image `box` px big at most (whole zoom steps for small pixel art). */
function fitCanvas(c: HTMLCanvasElement, w: number, hgt: number, box: number) {
  const m = Math.max(w, hgt);
  const s = m <= box ? Math.max(1, Math.floor(box / m)) : box / m;
  c.style.width = `${Math.round(w * s)}px`;
  c.style.height = `${Math.round(hgt * s)}px`;
}

/** A looping preview at game speed in a checkered box. */
function previewBox(size: number): { el: HTMLElement; set(src: PlaySource | null, w: number, h: number): void; stop(): void } {
  const canvas = h('canvas', { class: 'pixelated', 'aria-hidden': 'true' });
  const el = h('div', { class: 'an-pv checker', style: { width: `${size}px`, height: `${size}px` } }, canvas);
  const player = createPlayer((img) => paintCanvas(canvas, img));
  return {
    el,
    set(src, w, hgt) {
      player.stop();
      player.set(src);
      fitCanvas(canvas, w, hgt, size - 12);
      if (src) player.play();
    },
    stop: () => player.stop(),
  };
}

// ---------------------------------------------------------------------------------------------
// Timing

export interface TimingDialogOptions {
  anim: TextureAnimation;
  frames: ImageData[];
  edition: 'java' | 'bedrock';
  /** The pack's versions can blend frames (Java 1.8+, Bedrock) */
  canBlend: boolean;
  blend: 'rgba' | 'rgb';
  onApply(next: TextureAnimation): void;
}

export function openTimingDialog(o: TimingDialogOptions): void {
  const count = o.frames.length;
  const state = { frametime: clampTicks(o.anim.frametime), frames: normalizeFrames(o.anim.frames, o.anim.frametime, count), interpolate: !!o.anim.interpolate && o.canBlend };
  const fw = o.frames[0].width;
  const fh = o.frames[0].height;

  const speedId = uid('an-speed');
  const speed = h('input', { type: 'number', class: 'input an-num', id: speedId, min: 1, max: MAX_TICKS, step: 1, value: String(state.frametime), inputMode: 'numeric' });
  const unit = h('span', { class: 'an-unit' });
  const per = h('span', { class: 'an-per' });
  const pv = previewBox(96);
  const loop = h('p', { class: 'an-loop' });

  const blend = toggle({
    label: ta.timing.blend,
    value: state.interpolate,
    description: o.canBlend ? ta.timing.blendHint : ta.timing.blendOld,
    disabled: !o.canBlend,
    onChange: (v) => {
      state.interpolate = v;
      refresh();
    },
  });

  // each frame's own time
  const rows: { input: HTMLInputElement; secs: HTMLElement }[] = [];
  const list = h('div', { class: 'an-times' });
  o.frames.forEach((f, i) => {
    const c = h('canvas', { class: 'pixelated', 'aria-hidden': 'true' });
    paintCanvas(c, f);
    fitCanvas(c, fw, fh, 24);
    const id = uid('an-t');
    const input = h('input', { type: 'number', class: 'input an-num', id, min: 1, max: MAX_TICKS, step: 1, inputMode: 'numeric', dataset: { i: String(i) } });
    const s = h('span', { class: 'an-secs' });
    input.addEventListener('input', () => {
      const v = input.value.trim() ? Number(input.value) : state.frametime;
      if (!Number.isFinite(v) || v < 1) return;
      state.frames = withFrameTime(state, count, i, v);
      refresh(input);
    });
    rows.push({ input, secs: s });
    // the thumbnail with its number names the field
    const label = h('label', { htmlFor: id, class: 'an-time-label' }, h('span', { class: 'an-thumb checker' }, c), h('span', { class: 'an-time-n', 'aria-hidden': 'true' }, String(i + 1)), h('span', { class: 'sr-only' }, fmt(ta.timing.frame, { n: i + 1 })));
    list.append(h('div', { class: 'an-time' }, label, input, s));
  });

  const orderId = uid('an-order');
  const order = h('input', { type: 'text', class: 'input an-order', id: orderId, spellcheck: false, autocomplete: 'off', placeholder: Array.from({ length: Math.min(count, 4) }, (_, i) => i + 1).join(', '), 'aria-describedby': `${orderId}-hint` });
  const orderMsg = h('p', { class: 'an-msg', role: 'alert', hidden: true });
  order.addEventListener('input', () => {
    const r = parseOrder(order.value, count);
    if (!Array.isArray(r)) {
      orderMsg.hidden = false;
      orderMsg.textContent = r.error === 'syntax' ? fmt(ta.timing.orderSyntax, { token: r.token }) : fmt(ta.timing.orderRange, { token: r.token, count });
      return;
    }
    orderMsg.hidden = true;
    state.frames = normalizeFrames(r.length ? r : undefined, state.frametime, count);
    refresh(order);
  });

  speed.addEventListener('input', () => {
    const v = Number(speed.value);
    if (!Number.isFinite(v) || v < 1) return;
    state.frametime = clampTicks(v);
    state.frames = normalizeFrames(state.frames, state.frametime, count);
    refresh(speed);
  });

  /** Fields and texts from the state (the field being typed in keeps its text) */
  function refresh(typing?: HTMLElement) {
    unit.textContent = fmt(ta.timing.ticks, { count: state.frametime });
    per.textContent = fmt(ta.timing.perSecond, { seconds: secs(state.frametime), fps: num(Math.round((20 / state.frametime) * 100) / 100) });
    rows.forEach((r, i) => {
      const t = frameTime(state, i);
      const own = t !== state.frametime && state.frames?.some((s) => s.index === i);
      if (r.input !== typing) r.input.value = own ? String(t) : '';
      r.input.placeholder = String(state.frametime);
      r.secs.textContent = fmt(ta.timing.secs, { seconds: secs(t) });
    });
    if (order !== typing) order.value = formatOrder(state.frames, state.frametime, count);
    const ticks = loopTicks(state, count);
    loop.textContent = fmt(ta.timing.loop, { seconds: secs(ticks), ticks });
    pv.set({ frames: o.frames, steps: playSteps(state, count), interpolate: state.interpolate, blend: o.blend }, fw, fh);
  }

  const body = h(
    'div',
    { class: 'an' },
    h('p', { class: 'an-intro' }, icon('clock'), h('span', null, ta.timing.ticksIntro)),
    h(
      'div',
      { class: 'an-top' },
      h(
        'div',
        { class: 'an-top-main' },
        h('label', { class: 'field-label', htmlFor: speedId }, ta.timing.speed),
        h('div', { class: 'an-speed' }, speed, unit, per),
        loop,
      ),
      h('figure', { class: 'an-fig' }, pv.el, h('figcaption', null, ta.timing.preview)),
    ),
    blend,
    h('h3', { class: 'an-section' }, ta.timing.frames),
    h('p', { class: 'an-hint' }, ta.timing.framesHint),
    list,
    h(
      'details',
      { class: 'an-more', open: !!state.frames && !playSteps(state, count).every((s, i) => s.index === i) },
      h('summary', null, ta.timing.order),
      h('label', { class: 'sr-only', htmlFor: orderId }, ta.timing.order),
      order,
      h('p', { class: 'an-hint', id: `${orderId}-hint` }, ta.timing.orderHint),
      orderMsg,
    ),
    o.edition === 'bedrock' ? h('p', { class: 'tx-inline-note' }, icon('info'), h('span', null, ta.timing.bedrock)) : null,
  );
  refresh();
  openModal({
    title: ta.timing.title,
    body,
    width: 560,
    class: 'an-modal an-timing-modal',
    onClose: () => pv.stop(),
    actions: [
      { label: ta.timing.cancel, variant: 'secondary' },
      {
        label: ta.timing.apply,
        variant: 'primary',
        onClick: () => {
          if (!orderMsg.hidden) {
            order.focus();
            return false;
          }
          const next: TextureAnimation = { ...o.anim, frametime: state.frametime, interpolate: state.interpolate || undefined, frames: normalizeFrames(state.frames, state.frametime, count), updatedAt: Date.now() };
          if (!next.frames) delete next.frames;
          if (!next.interpolate) delete next.interpolate;
          o.onApply(next);
          return true;
        },
      },
    ],
  });
}

// ---------------------------------------------------------------------------------------------
// Import

export interface ImportDialogOptions {
  frameW: number;
  frameH: number;
  /** The texture is animated: the frames can go after `current` */
  animated: boolean;
  current: number;
  /** Most frames that can come in (replacing / added) */
  room: { replace: number; after: number };
  blend: 'rgba' | 'rgb';
  files?: File[];
  onApply(frames: ImageData[], times: number[] | null, mode: 'replace' | 'after'): void;
}

const ACCEPT = 'image/*,.png,.gif,.jpg,.jpeg,.webp,.bmp,.tga';
const MAX_FILE_BYTES = 40 * 1024 * 1024;
const MAX_PICTURE = 4096 * 4096;
const SHOWN = 24;

export function openImportDialog(o: ImportDialogOptions): void {
  let frames: ImageData[] = [];
  let gifTimes: number[] | null = null;
  let mode: 'replace' | 'after' = o.animated ? 'after' : 'replace';
  let useGif = true;
  const size = `${o.frameW} × ${o.frameH}`;

  const dz = dropzone({
    accept: ACCEPT,
    multiple: true,
    label: byPointer(ta.import.drop, ta.import.dropTouch),
    hint: fmt(ta.import.dropHint, { size }),
    icon: 'images',
    onFiles: (files) => void load(files),
  });
  const reading = h('div', { class: 'an-reading', hidden: true }, spinner(24), h('span', null, ta.import.reading));
  const thumbs = h('div', { class: 'an-thumbs' });
  const found = h('p', { class: 'an-found' });
  const pv = previewBox(112);
  const whereSeg = segmented<'replace' | 'after'>({
    value: mode,
    size: 'sm',
    label: ta.import.where,
    options: [
      { value: 'replace', label: ta.import.replace },
      { value: 'after', label: fmt(ta.import.after, { n: o.current + 1 }) },
    ],
    onChange: (v) => {
      mode = v;
      render();
    },
  });
  const timingSeg = segmented<'gif' | 'keep'>({
    value: 'gif',
    size: 'sm',
    label: ta.import.timing,
    options: [
      { value: 'gif', label: ta.import.gifTiming },
      { value: 'keep', label: ta.import.keepTiming },
    ],
    onChange: (v) => {
      useGif = v === 'gif';
      render();
    },
  });
  const whereRow = h('div', { class: 'an-opt' }, h('span', { class: 'field-label' }, ta.import.where), whereSeg);
  const timingRow = h('div', { class: 'an-opt' }, h('span', { class: 'field-label' }, ta.import.timing), timingSeg);
  whereRow.hidden = !o.animated;
  const again = h('button', { type: 'button', class: 'btn btn-ghost btn-sm an-again' }, icon('images'), h('span', { class: 'btn-label' }, ta.import.choose));
  again.addEventListener('click', () => dz.querySelector<HTMLInputElement>('input[type=file]')?.click());
  const editor = h('div', { class: 'an-import', hidden: true }, h('div', { class: 'an-import-top' }, pv.el, h('div', { class: 'an-import-info' }, found, thumbs)), whereRow, timingRow, again);
  const body = h('div', { class: 'an' }, dz, reading, editor);

  const modal = openModal({
    title: ta.import.title,
    body,
    width: 600,
    class: 'an-modal an-import-modal',
    onClose: () => pv.stop(),
    actions: [
      { label: ta.import.cancel, variant: 'secondary' },
      {
        label: ta.import.apply,
        variant: 'primary',
        onClick: () => {
          if (!frames.length) {
            toast(ta.import.chooseFirst, { tone: 'warn' });
            return false;
          }
          const room = mode === 'replace' ? o.room.replace : o.room.after;
          const list = frames.slice(0, room);
          o.onApply(list, gifTimes && useGif ? gifTimes.slice(0, room) : null, mode);
          if (frames.length > room) toast(fmt(ta.toasts.tooMany, { max: room }), { tone: 'warn' });
          return true;
        },
      },
    ],
  });
  const applyBtn = modal.el.querySelector<HTMLButtonElement>('.modal-footer .btn-primary');
  if (applyBtn) applyBtn.disabled = true;

  function render() {
    if (!frames.length) return;
    const times = gifTimes && useGif ? gifTimes : null;
    const steps = frames.map((_, i) => ({ index: i, time: times?.[i] ?? 4 }));
    const ticks = steps.reduce((n, s) => n + s.time, 0);
    found.textContent = times ? fmt(ta.import.found, { count: frames.length, seconds: secs(ticks) }) : fmt(ta.import.count, { count: frames.length });
    pv.set({ frames, steps, interpolate: false, blend: o.blend }, o.frameW, o.frameH);
  }

  let loadId = 0;
  async function load(files: File[]) {
    const my = ++loadId;
    dz.hidden = true;
    editor.hidden = true;
    reading.hidden = false;
    const out: ImageData[] = [];
    let times: number[] | null = null;
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    try {
      for (const f of sorted) {
        if (f.size > MAX_FILE_BYTES) throw Object.assign(new Error('big'), { size: f.size });
        const bytes = new Uint8Array(await f.arrayBuffer());
        if (isGif(bytes)) {
          const gif = decodeGif(bytes, 1024);
          const pad = out.length;
          times ??= Array.from({ length: pad }, () => 4);
          for (const fr of gif.frames) {
            out.push(fitFrame(createImageData(gif.width, gif.height, fr.data), o.frameW, o.frameH));
            times.push(gifDelayToTicks(fr.delay));
          }
          continue;
        }
        const img = await decodeImage(bytes, f.name.split('.').pop());
        if (img.width * img.height > MAX_PICTURE) throw Object.assign(new Error('big'), { dims: `${img.width}×${img.height}` });
        const parts = sorted.length === 1 ? sliceSheet(img, o.frameW, o.frameH) : [img];
        for (const p of parts) {
          out.push(fitFrame(p, o.frameW, o.frameH));
          times?.push(4);
        }
      }
    } catch (err) {
      if (my !== loadId) return;
      reading.hidden = true;
      dz.hidden = false;
      const e = err as { size?: number; dims?: string };
      dz.setError(e.dims || e.size ? fmt(ta.import.tooBig, { size: e.dims ?? `${Math.round((e.size ?? 0) / 1048576)} MB` }) : ta.import.unreadable);
      return;
    }
    if (my !== loadId || !modal.el.isConnected) return;
    reading.hidden = true;
    frames = out;
    gifTimes = times;
    editor.hidden = false;
    timingRow.hidden = !times || !o.animated;
    if (applyBtn) applyBtn.disabled = false;
    thumbs.replaceChildren(
      ...frames.slice(0, SHOWN).map((f): Node => {
        const c = h('canvas', { class: 'pixelated', 'aria-hidden': 'true' });
        paintCanvas(c, f);
        fitCanvas(c, o.frameW, o.frameH, 28);
        return h('span', { class: 'an-thumb checker' }, c);
      }),
      ...(frames.length > SHOWN ? [h('span', { class: 'an-thumb-more' }, fmt(ta.import.more, { count: frames.length - SHOWN }))] : []),
    );
    // one picture: added to the animation; a whole set replaces the frames of a fresh one
    if (o.animated) {
      mode = frames.length > 1 && frames.length >= 4 ? 'replace' : 'after';
      whereSeg.setValue(mode);
    }
    render();
    applyBtn?.focus();
  }

  if (o.files?.length) void load(o.files);
}

// ---------------------------------------------------------------------------------------------
// Save as GIF

export interface GifDialogOptions {
  /** File name without extension */
  name: string;
  source: PlaySource;
}

const GIF_SCALES = [1, 2, 4, 8, 16];

export function openGifDialog(o: GifDialogOptions): void {
  const f0 = o.source.frames[0];
  const big = Math.max(f0.width, f0.height);
  const scales = GIF_SCALES.filter((s) => s === 1 || big * s <= 1024);
  let scale = [...scales].reverse().find((s) => big * s <= 256) ?? 1;
  const pv = previewBox(160);
  const sizeSeg = segmented<string>({
    value: String(scale),
    size: 'sm',
    label: ta.gif.size,
    options: scales.map((s) => ({ value: String(s), label: `${s}×` })),
    onChange: (v) => {
      scale = Number(v);
      paintSize();
    },
  });
  const sizeText = h('span', { class: 'an-hint' });
  const paintSize = () => (sizeText.textContent = fmt(ta.gif.sizePx, { size: `${f0.width * scale} × ${f0.height * scale}` }));
  paintSize();
  const semi = o.source.frames.some((f) => {
    for (let i = 3; i < f.data.length; i += 4) if (f.data[i] > 0 && f.data[i] < 255) return true;
    return false;
  });
  const body = h(
    'div',
    { class: 'an an-gif' },
    h('div', { class: 'an-gif-pv' }, pv.el),
    h('div', { class: 'an-opt' }, h('span', { class: 'field-label' }, ta.gif.size), h('div', { class: 'an-opt-end' }, sizeSeg, sizeText)),
    semi ? h('p', { class: 'tx-inline-note' }, icon('info'), h('span', null, ta.gif.alphaNote)) : null,
    o.source.interpolate ? h('p', { class: 'tx-inline-note' }, icon('info'), h('span', null, ta.gif.blendNote)) : null,
  );
  pv.set(o.source, f0.width, f0.height);
  openModal({
    title: ta.gif.title,
    body,
    width: 460,
    class: 'an-modal an-gif-modal',
    onClose: () => pv.stop(),
    actions: [
      { label: ta.gif.cancel, variant: 'secondary' },
      {
        label: ta.gif.save,
        variant: 'primary',
        onClick: () => {
          try {
            const list = gifFrames(o.source);
            const w = f0.width * scale;
            const hh = f0.height * scale;
            const bytes = encodeGif(w, hh, list.map((g) => ({ data: (scale === 1 ? g.image : resizeNearest(g.image, w, hh)).data, delay: g.delay })));
            saveBlob(new Blob([bytes.slice() as Uint8Array<ArrayBuffer>], { type: 'image/gif' }), `${o.name}.gif`);
            return true;
          } catch (err) {
            console.error(err);
            toast(ta.gif.failed, { tone: 'error' });
            return false;
          }
        },
      },
    ],
  });
}
