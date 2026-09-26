// "Upload image" dialog: decode any picture, resize it to the texture (nearest or smooth, stretch /
// fit / crop), with a live preview. Animated strips can take a whole strip, one frame, or all frames.

import { decodeImage, fitToSize } from '../../../core/image';
import { h } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { segmented } from '../../../ui/components';
import { dropzone } from '../../../ui/dropzone';
import { openModal } from '../../../ui/modal';
import { toast } from '../../../ui/toast';
import { paintCanvas } from './thumbs';

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

export function openUploadDialog(opts: UploadOptions): void {
  let src: ImageData | null = null;
  let mode: 'nearest' | 'smooth' = 'nearest';
  let fit: 'stretch' | 'contain' | 'cover' = 'stretch';
  let scope: UploadScope = 'full';
  let result: ImageData | null = null;

  const dz = dropzone({
    accept: ACCEPT,
    label: 'Drop an image here or click to choose',
    hint: 'PNG, JPG, GIF, WebP or TGA — any size, it gets resized for you',
    icon: 'image',
    onFiles: (files) => void load(files[0]),
  });

  const srcCanvas = h('canvas', { class: 'tx-up-src' });
  const outCanvas = h('canvas', { class: 'tx-up-out pixelated' });
  const srcInfo = h('span', { class: 'faint small' });
  const outInfo = h('span', { class: 'faint small' });
  const modeSeg = segmented<'nearest' | 'smooth'>({
    value: mode,
    label: 'Resize style',
    size: 'sm',
    options: [
      { value: 'nearest', label: 'Sharp pixels' },
      { value: 'smooth', label: 'Smooth' },
    ],
    onChange: (v) => {
      mode = v;
      render();
    },
  });
  const fitSeg = segmented<'stretch' | 'contain' | 'cover'>({
    value: fit,
    label: 'Fit',
    size: 'sm',
    options: [
      { value: 'stretch', label: 'Stretch' },
      { value: 'cover', label: 'Fill' },
      { value: 'contain', label: 'Fit' },
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
        label: 'What to replace',
        size: 'sm',
        options: [
          { value: 'full', label: `All ${a.count} frames` },
          { value: 'frame', label: `Frame ${a.index + 1}` },
          { value: 'all-frames', label: 'Same on every frame' },
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
      h('figure', { class: 'tx-up-fig' }, h('div', { class: 'tx-up-box checker' }, srcCanvas), h('figcaption', null, 'Your image', srcInfo)),
      h('span', { class: 'tx-up-arrow', 'aria-hidden': 'true' }, icon('arrow-right')),
      h('figure', { class: 'tx-up-fig' }, h('div', { class: 'tx-up-box checker' }, outCanvas), h('figcaption', null, 'Becomes', outInfo)),
    ),
    h('div', { class: 'tx-up-opts' }, h('div', { class: 'tx-up-opt' }, h('span', { class: 'field-label' }, 'Resize'), modeSeg), h('div', { class: 'tx-up-opt' }, h('span', { class: 'field-label' }, 'Shape'), fitSeg), scopeSeg ? h('div', { class: 'tx-up-opt' }, h('span', { class: 'field-label' }, 'Animation'), scopeSeg) : null),
    opts.alphaData
      ? h('p', { class: 'tx-inline-note warn' }, icon('warning-diamond'), 'Bedrock uses this texture’s transparency as a colour mask. Your image’s transparency replaces it.')
      : null,
  );

  const body = h('div', { class: 'tx-upload' }, dz, editor);
  const modal = openModal({
    title: `Upload image for ${opts.name}`,
    body,
    width: 620,
    class: 'tx-upload-modal',
    actions: [
      { label: 'Cancel', variant: 'secondary' },
      {
        label: 'Replace texture',
        variant: 'primary',
        onClick: () => {
          if (!result) {
            toast('Choose an image first.', { tone: 'warn' });
            return false;
          }
          opts.onApply(result, scope);
          return true;
        },
      },
    ],
  });

  const target = () => (a && scope !== 'full' ? { w: a.frameW, h: a.frameH } : { w: opts.width, h: opts.height });

  function render() {
    if (!src) return;
    const t = target();
    result = fitToSize(src, t.w, t.h, mode, fit);
    paintCanvas(outCanvas, result);
    const box = 176;
    const zoom = Math.max(1, Math.floor(box / Math.max(t.w, t.h)));
    const sc = Math.min(zoom, box / Math.max(t.w, t.h));
    outCanvas.style.width = `${Math.round(t.w * sc)}px`;
    outCanvas.style.height = `${Math.round(t.h * sc)}px`;
    outCanvas.classList.toggle('pixelated', sc >= 1);
    outInfo.textContent = ` ${t.w}×${t.h}`;
  }

  async function load(file: File | undefined) {
    if (!file) return;
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      src = await decodeImage(file, ext);
    } catch (err) {
      console.error(err);
      dz.setError("That file couldn't be read as an image. Try a PNG or JPG.");
      return;
    }
    dz.hidden = true;
    editor.hidden = false;
    paintCanvas(srcCanvas, src);
    const box = 176;
    const s = Math.max(src.width, src.height) <= box ? Math.max(1, Math.floor(box / Math.max(src.width, src.height))) : box / Math.max(src.width, src.height);
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
