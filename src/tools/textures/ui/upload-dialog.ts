// "Upload image" dialog: decode any picture, resize it to the texture (nearest or smooth, stretch /
// fit / crop), with a live preview. Animated strips can take a whole strip, one frame, or all frames.

import { decodeImage, fitToSize } from '../../../core/image';
import { formatBytes } from '../../../ui/dom';
import { h } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { segmented, spinner } from '../../../ui/components';
import { dropzone } from '../../../ui/dropzone';
import { openModal } from '../../../ui/modal';
import { toast } from '../../../ui/toast';
import { paintCanvas } from './thumbs';
import { fmt } from '../../../i18n/editor-text';
import { te } from './i18n/editor';

export type UploadScope = 'full' | 'frame' | 'all-frames';

export interface UploadOptions {
  file?: File;
  name: string;
  /** Full texture size */
  width: number;
  height: number;
  anim?: { frameW: number; frameH: number; count: number; index: number } | null;
  /** Bedrock texture whose alpha is data */
  alphaData?: boolean;
  onApply(img: ImageData, scope: UploadScope): void;
}

const ACCEPT = 'image/*,.png,.tga,.jpg,.jpeg,.gif,.webp,.bmp';
/** Bigger pictures take seconds and hundreds of MB to decode; no texture needs them. */
const MAX_FILE_BYTES = 60 * 1024 * 1024;
const MAX_PIXELS = 36 * 1024 * 1024;
/** The "Your image" preview never needs more than this many pixels per side. */
const PREVIEW_MAX = 352;

export function openUploadDialog(opts: UploadOptions): void {
  let src: ImageData | null = null;
  let mode: 'nearest' | 'smooth' = 'nearest';
  let fit: 'stretch' | 'contain' | 'cover' = 'stretch';
  let scope: UploadScope = 'full';
  let result: ImageData | null = null;

  const dz = dropzone({
    accept: ACCEPT,
    label: te.upload.drop,
    hint: te.upload.dropHint,
    icon: 'image',
    onFiles: (files) => void load(files[0]),
  });

  const srcCanvas = h('canvas', { class: 'tx-up-src' });
  const outCanvas = h('canvas', { class: 'tx-up-out pixelated' });
  const srcInfo = h('span', { class: 'faint small' });
  const outInfo = h('span', { class: 'faint small' });
  const modeSeg = segmented<'nearest' | 'smooth'>({
    value: mode,
    label: te.upload.resizeStyle,
    size: 'sm',
    options: [
      { value: 'nearest', label: te.upload.sharp },
      { value: 'smooth', label: te.upload.smooth },
    ],
    onChange: (v) => {
      mode = v;
      render();
    },
  });
  const fitSeg = segmented<'stretch' | 'contain' | 'cover'>({
    value: fit,
    label: te.upload.fit,
    size: 'sm',
    options: [
      { value: 'stretch', label: te.upload.stretch },
      { value: 'cover', label: te.upload.fill },
      { value: 'contain', label: te.upload.fit },
    ],
    onChange: (v) => {
      fit = v;
      render();
    },
  });
  const a = opts.anim;
  const scopeSeg = a
    ? segmented<UploadScope>({
        value: scope,
        label: te.upload.whatToReplace,
        size: 'sm',
        options: [
          { value: 'full', label: te.upload.wholeStrip },
          { value: 'frame', label: fmt(te.upload.frameOnly, { n: a.index + 1 }) },
          { value: 'all-frames', label: te.upload.everyFrame },
        ],
        onChange: (v) => {
          scope = v;
          render();
        },
      })
    : null;

  const editor = h(
    'div',
    { class: 'tx-up-editor', hidden: true },
    h(
      'div',
      { class: 'tx-up-compare' },
      h('figure', { class: 'tx-up-fig' }, h('div', { class: 'tx-up-box checker' }, srcCanvas), h('figcaption', null, te.upload.yourImage, srcInfo)),
      h('span', { class: 'tx-up-arrow', 'aria-hidden': 'true' }, icon('arrow-right')),
      h('figure', { class: 'tx-up-fig' }, h('div', { class: 'tx-up-box checker' }, outCanvas), h('figcaption', null, te.upload.becomes, outInfo)),
    ),
    h('div', { class: 'tx-up-opts' }, h('div', { class: 'tx-up-opt' }, h('span', { class: 'field-label' }, te.upload.resize), modeSeg), h('div', { class: 'tx-up-opt' }, h('span', { class: 'field-label' }, te.upload.shape), fitSeg), scopeSeg ? h('div', { class: 'tx-up-opt' }, h('span', { class: 'field-label' }, te.upload.animation), scopeSeg) : null),
    opts.alphaData
      ? h('p', { class: 'tx-inline-note warn' }, icon('warning-diamond'), te.upload.alphaWarning)
      : null,
  );
  const again = h('button', { type: 'button', class: 'btn btn-ghost btn-sm tx-up-again' }, icon('image'), h('span', { class: 'btn-label' }, te.upload.choose));
  again.addEventListener('click', () => (dz.querySelector('input[type=file]') as HTMLInputElement | null)?.click());
  editor.appendChild(again);

  const reading = h('div', { class: 'tx-up-reading', hidden: true }, spinner(24), h('span', null, te.upload.reading));
  const body = h('div', { class: 'tx-upload' }, dz, reading, editor);
  const modal = openModal({
    title: fmt(te.upload.title, { name: opts.name }),
    body,
    width: 620,
    class: 'tx-upload-modal',
    actions: [
      { label: te.upload.cancel, variant: 'secondary' },
      {
        label: te.upload.replace,
        variant: 'primary',
        onClick: () => {
          if (!result) {
            toast(te.upload.chooseFirst, { tone: 'warn' });
            return false;
          }
          opts.onApply(result, scope);
          return true;
        },
      },
    ],
  });

  const applyBtn = modal.el.querySelector<HTMLButtonElement>('.modal-footer .btn-primary');
  if (applyBtn) applyBtn.disabled = true;

  /** Inner size of the preview boxes (smaller on phones). */
  const boxSize = () => Math.max(64, ((outCanvas.parentElement?.clientWidth || 192) - 16));

  const target = () => (a && scope !== 'full' ? { w: a.frameW, h: a.frameH } : { w: opts.width, h: opts.height });

  function render() {
    if (!src) return;
    const t = target();
    result = fitToSize(src, t.w, t.h, mode, fit);
    paintCanvas(outCanvas, result);
    const box = boxSize();
    const zoom = Math.max(1, Math.floor(box / Math.max(t.w, t.h)));
    const sc = Math.min(zoom, box / Math.max(t.w, t.h));
    outCanvas.style.width = `${Math.round(t.w * sc)}px`;
    outCanvas.style.height = `${Math.round(t.h * sc)}px`;
    outCanvas.classList.toggle('pixelated', sc >= 1);
    outInfo.textContent = ` ${t.w}×${t.h}`;
  }

  let loadId = 0;
  async function load(file: File | undefined) {
    if (!file) return;
    const my = ++loadId;
    if (file.size > MAX_FILE_BYTES) {
      dz.setError(fmt(te.upload.tooBig, { size: formatBytes(file.size), max: formatBytes(MAX_FILE_BYTES) }));
      return;
    }
    let img: ImageData;
    dz.hidden = true;
    editor.hidden = true;
    reading.hidden = false;
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      img = await decodeImage(file, ext);
    } catch {
      if (my !== loadId) return;
      reading.hidden = true;
      dz.hidden = false;
      dz.setError(te.upload.unreadable);
      return;
    }
    if (my !== loadId || !modal.el.isConnected) return;
    reading.hidden = true;
    if (img.width * img.height > MAX_PIXELS) {
      dz.hidden = false;
      dz.setError(fmt(te.upload.huge, { size: `${img.width}×${img.height}`, max: `${Math.floor(Math.sqrt(MAX_PIXELS))}×${Math.floor(Math.sqrt(MAX_PIXELS))}` }));
      return;
    }
    src = img;
    dz.hidden = true;
    editor.hidden = false;
    if (applyBtn) applyBtn.disabled = false;
    const big = Math.max(src.width, src.height);
    const shown = big > PREVIEW_MAX ? fitToSize(src, Math.max(1, Math.round((src.width * PREVIEW_MAX) / big)), Math.max(1, Math.round((src.height * PREVIEW_MAX) / big)), 'smooth', 'stretch') : src;
    paintCanvas(srcCanvas, shown);
    const box = boxSize();
    const s = big <= box ? Math.max(1, Math.floor(box / big)) : box / big;
    srcCanvas.style.width = `${Math.round(src.width * s)}px`;
    srcCanvas.style.height = `${Math.round(src.height * s)}px`;
    srcCanvas.classList.toggle('pixelated', s >= 1);
    srcInfo.textContent = ` ${src.width}×${src.height}`;
    // Sensible defaults: small art stays sharp, photos get smoothed; animation strips replace every frame
    const t0 = { w: opts.width, h: opts.height };
    mode = src.width <= t0.w * 4 && src.height <= t0.h * 4 ? 'nearest' : 'smooth';
    modeSeg.setValue(mode);
    if (a) {
      const stripRatio = opts.height / opts.width;
      const ratio = src.height / src.width;
      scope = Math.abs(ratio - stripRatio) / stripRatio < 0.02 ? 'full' : 'all-frames';
      scopeSeg?.setValue(scope);
    }
    const t = target();
    fit = Math.abs(src.width / src.height - t.w / t.h) < 0.01 ? 'stretch' : 'cover';
    fitSeg.setValue(fit);
    render();
    (modal.el.querySelector('.modal-footer .btn-primary') as HTMLButtonElement | null)?.focus();
  }

  if (opts.file) void load(opts.file);
}
