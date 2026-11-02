// The skin's picture card (Export menu → Share a picture): the face and name on the left, the skin
// in 3D from the front and the back on the right, rendered the way the pose maker saves its
// pictures (a hidden 3D view, renderImage). Loaded on the first use.

import type { SkinModel } from '../../../core/types';
import { yieldToMain } from '../../../core/yield';
import { textLocale } from '../../../i18n/editor-text';
import {
  CARD_COLORS as C,
  CARD_H,
  CARD_PAD,
  CARD_W,
  cardBlob,
  cardFileName,
  cardFont,
  createCard,
  deliverCard,
  drawPixels,
  layoutText,
  loadCardFonts,
  paintBackdrop,
  paintChecker,
  paintChip,
  paintCredit,
  paintText,
  fillRoundRect,
  type TextBox,
} from '../../../shared/share-card';
import { createSkinPreview, type SkinOrbit } from '../skin-preview';
import { NEUTRAL_POSE, poseTransforms } from '../pose';
import { editorText as t } from '../i18n/editor';
import { t as startText } from '../i18n/text';

const ACCENT = C.blue;
/** Each figure's render (twice the size it is drawn at, for smooth edges) */
const FIG_W = 300;
const FIG_H = 540;
/** The largest a figure is drawn on the card */
const FIG_MAX_H = 480;
const FIG_MAX_W = 250;
/** A little turned, so the 3D shows: the front from the right, the back from the left */
const FRONT: SkinOrbit = { yaw: 24, pitch: 6, zoom: 0.92, focusY: 0 };
const BACK: SkinOrbit = { yaw: 204, pitch: 6, zoom: 0.92, focusY: 0 };

export interface SkinCardInput {
  image: ImageData;
  model: SkinModel;
  /** The skin's name ('' when it has none of its own) */
  name: string;
}

/** The face (head front, with the hat layer on top), as a little picture. */
function faceOf(img: ImageData): ImageData {
  const s = img.width / 64;
  const n = 8 * s;
  const out = new ImageData(n, n);
  const copy = (sx: number, sy: number, over: boolean) => {
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const i = ((sy * s + y) * img.width + sx * s + x) * 4;
        const o = (y * n + x) * 4;
        const a = img.data[i + 3];
        if (over && a < 128) continue;
        out.data.set([img.data[i], img.data[i + 1], img.data[i + 2], 255], o);
      }
  };
  copy(8, 8, false);
  copy(40, 8, true);
  return out;
}

/** The part of a render the player covers (its pixels that aren't see-through). */
function contentBox(c: HTMLCanvasElement): { x: number; y: number; w: number; h: number } {
  const d = c.getContext('2d')?.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width;
  let y0 = c.height;
  let x1 = -1;
  let y1 = -1;
  if (d)
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) {
        if (d[(y * c.width + x) * 4 + 3] < 8) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return x1 < 0 ? { x: 0, y: 0, w: c.width, h: c.height } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Renders the player from two sides in a hidden 3D view. */
async function renderFigures(input: SkinCardInput): Promise<[HTMLCanvasElement, HTMLCanvasElement]> {
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.inert = true;
  host.style.cssText = `position:fixed;left:-${FIG_W * 4}px;top:0;width:${FIG_W}px;height:${FIG_H}px;pointer-events:none;contain:strict;`;
  document.body.appendChild(host);
  const preview = createSkinPreview(host, { model: input.model, skin: input.image, animation: 'none', background: null });
  try {
    preview.setPose(poseTransforms(NEUTRAL_POSE));
    const shot = (o: SkinOrbit) => {
      preview.setOrbit(o, true);
      const c = preview.renderImage(FIG_W * 2, FIG_H * 2);
      if (!c) throw new Error('3D preview unavailable');
      return c;
    };
    const front = shot(FRONT);
    await yieldToMain();
    const back = shot(BACK);
    return [front, back];
  } finally {
    preview.destroy();
    host.remove();
  }
}

/** The PNG card for the skin in the editor. */
export async function makeSkinCard(input: SkinCardInput): Promise<{ blob: Blob; filename: string; title: string }> {
  const name = input.name.trim();
  const hd = input.image.width === 128;
  const arms = input.model === 'slim' ? startText.defaults.slim : startText.defaults.classic;
  await loadCardFonts([
    { font: cardFont(56, true), text: name || t.share.kind },
    { font: cardFont(16, true), text: t.share.kind },
    { font: cardFont(16), text: arms + startText.pick.hd },
    { font: cardFont(24), text: 'texturepackmaker.com' },
  ]);
  await yieldToMain();
  const [front, back] = await renderFigures(input);
  await yieldToMain();

  const { canvas, ctx } = createCard();
  const footBase = CARD_H - CARD_PAD + 8;
  // the two figures side by side on the right, one size, standing on one floor
  const boxes = [front, back].map(contentBox);
  const tallest = Math.max(...boxes.map((b) => b.h), 1);
  const widest = Math.max(...boxes.map((b) => b.w), 1);
  const floor = footBase - 72;
  const k = Math.min(FIG_MAX_H / tallest, FIG_MAX_W / widest);
  const slot = FIG_MAX_W + 48;
  const figsX = CARD_W - CARD_PAD - 2 * slot + 24;
  paintBackdrop(ctx, ACCENT, { x: figsX + slot, y: floor - FIG_MAX_H * 0.55, r: 440 });
  [front, back].forEach((pic, i) => {
    const b = boxes[i];
    const cx = figsX + slot * i + slot / 2;
    const w = b.w * k;
    const h = b.h * k;
    const sh = ctx.createRadialGradient(cx, floor, 0, cx, floor, w * 0.75);
    sh.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
    sh.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.save();
    ctx.translate(cx, floor);
    ctx.scale(1, 0.18);
    ctx.translate(-cx, -floor);
    ctx.fillStyle = sh;
    ctx.fillRect(cx - w, floor - w, w * 2, w * 2);
    ctx.restore();
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(pic, b.x, b.y, b.w, b.h, Math.round(cx - w / 2), Math.round(floor - h), Math.round(w), Math.round(h));
    ctx.restore();
  });

  // ---- left: face, eyebrow, name, chips
  const left = CARD_PAD;
  const textW = figsX - 32 - left;
  const nameBox: TextBox = { x: left, y: 0, maxWidth: textW, size: 56, lineHeight: 64, maxLines: 3, bold: true, minSize: 40 };
  // a skin without a name of its own is titled "Minecraft skin" (no line above it then)
  const nameL = layoutText(ctx, [{ text: name || t.share.kind, color: C.text }], nameBox);
  const face = 128;
  const eyebrow = name ? 24 + 12 : 0;
  const blockH = face + 32 + eyebrow + nameL.height + 24 + 32;
  let y = Math.max(CARD_PAD, Math.round((footBase - 48 + CARD_PAD) / 2 - blockH / 2));
  paintChecker(ctx, left, y, face, face, 12, 16);
  drawPixels(ctx, faceOf(input.image), left, y, face, face);
  fillRoundRect(ctx, left, y, face, face, 12, 'rgba(0, 0, 0, 0)', 'rgba(255, 255, 255, 0.14)', 2);
  y += face + 32;
  if (name) {
    ctx.font = cardFont(16, true);
    ctx.fillStyle = ACCENT;
    ctx.fillText(t.share.kind.toLocaleUpperCase(textLocale()), left, y + 18);
  }
  y += eyebrow;
  paintText(ctx, nameL, { ...nameBox, y }, { shadow: true });
  y += nameL.height + 24;
  let cx = left;
  cx += paintChip(ctx, arms, cx, y, ACCENT) + 12;
  if (hd) paintChip(ctx, startText.pick.hd, cx, y, C.text2);

  paintCredit(ctx, CARD_W - CARD_PAD, footBase);
  await yieldToMain();
  const blob = await cardBlob(canvas);
  return { blob, filename: cardFileName(name, 'card', 'skin'), title: name || t.share.kind };
}

/** Makes the card and shares or downloads it. */
export async function shareSkinCard(input: SkinCardInput): Promise<{ result: 'shared' | 'saved' | 'cancelled'; filename: string }> {
  const card = await makeSkinCard(input);
  return { result: await deliverCard(card.blob, card.filename, card.title), filename: card.filename };
}
