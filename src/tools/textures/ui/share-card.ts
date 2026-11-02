// The pack's picture card (the share button in the top bar): icon, name and description on the left,
// a block made of a changed texture on the right (an isometric cube, drawn in 2D like the pack icon:
// no WebGL to fail), and a strip of the changed textures along the bottom, pixel-crisp. Loaded on
// the first click.

import type { TextureCategory } from '../../../core/types';
import { createImageData } from '../../../core/image';
import { yieldToMain } from '../../../core/yield';
import { fmt, num, textLocale } from '../../../i18n/editor-text';
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
  fillRoundRect,
  layoutText,
  loadCardFonts,
  paintBackdrop,
  paintChecker,
  paintChip,
  paintCredit,
  paintText,
  withAlpha,
  type TextBox,
  type TextRun,
} from '../../../shared/share-card';
import { applyEffects } from '../effects';
import { renderIsoCube } from '../iso-cube';
import { COLOR_CODES } from './mc-text';
import { isGrayscale, multiply, packIconImage } from './icon';
import type { TexStore } from './store';
import type { ThumbService } from './thumbs';
import type { TextureEntry } from './meta';
import { versionLabel } from './start-screen';
import { te } from './i18n/editor';

/** Which changed textures show first: the ones people recognise; sheets of UI and fonts never. */
const RANK: Partial<Record<TextureCategory, number>> = { block: 0, item: 1, particle: 2, painting: 2, effect: 2, armor: 3, entity: 3, environment: 4, misc: 5, other: 5 };
const SKIPPED: TextureCategory[] = ['gui', 'font', 'colormap', 'map'];
/** With nothing changed: the blocks everyone knows, as this pack shows them (its effects). */
const SHOWCASE = ['grass_block_side', 'stone', 'oak_planks', 'cobblestone', 'diamond_ore', 'oak_log', 'bricks', 'sand', 'iron_ore', 'crafting_table_front'];
const SHOWCASE_BEDROCK = ['grass_side_carried', 'stone', 'planks_oak', 'cobblestone', 'diamond_ore', 'log_oak', 'brick', 'sand', 'iron_ore', 'crafting_table_front'];
const MAX_ONE_ROW = 8;
const MAX_TWO_ROWS = 26;
const ACCENT = C.green;

interface Tile {
  entry: TextureEntry;
  img: ImageData;
}

/** Text of the pack with its § codes as coloured runs (black and dark blue lifted to read on the dark card). */
function mcRuns(text: string, base: string): TextRun[] {
  const runs: TextRun[] = [];
  let style: TextRun = { text: '', color: base };
  const lift = (hex: string) => (hex === '#000000' ? C.text3 : hex === '#0000aa' ? '#5f6cff' : hex);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '§' && i + 1 < text.length) {
      const code = text[++i].toLowerCase();
      if (style.text) runs.push(style);
      const next: TextRun = { ...style, text: '' };
      if (COLOR_CODES[code]) Object.assign(next, { color: lift(COLOR_CODES[code]), bold: false, italic: false, underline: false, strike: false });
      else if (code === 'l') next.bold = true;
      else if (code === 'o') next.italic = true;
      else if (code === 'n') next.underline = true;
      else if (code === 'm') next.strike = true;
      else if (code === 'r') Object.assign(next, { color: base, bold: false, italic: false, underline: false, strike: false });
      style = next;
      continue;
    }
    style.text += ch;
  }
  if (style.text) runs.push(style);
  return runs;
}

/** Evenly spread picks from a long list, so many changes show a mix rather than one A-to-Z run. */
function spread<T>(list: T[], n: number): T[] {
  if (list.length <= n) return list;
  return Array.from({ length: n }, (_, i) => list[Math.floor((i * list.length) / n)]);
}

/** Share of a picture's pixels that are (mostly) opaque: a full block, not a flower or glass. */
function coverage(img: ImageData): number {
  let n = 0;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] >= 200) n++;
  return n / (img.width * img.height);
}

/** The texture's first square (animation strips), as the browser's thumbnails show it. */
function square(img: ImageData): ImageData {
  if (img.height <= img.width) return img;
  return createImageData(img.width, img.width, new Uint8ClampedArray(img.data.subarray(0, img.width * img.width * 4)));
}

/** The changed textures to show, best first (or the showcase blocks when nothing changed). */
function pickEntries(store: TexStore): { list: TextureEntry[]; changed: number } {
  const edited = [...store.editedPaths()].map((p) => store.byPath.get(p)).filter((e): e is TextureEntry => !!e);
  const shown = edited.filter((e) => !SKIPPED.includes(e.category));
  const pool = shown.length ? shown : edited;
  pool.sort((a, b) => (RANK[a.category] ?? 6) - (RANK[b.category] ?? 6) || a.id.localeCompare(b.id));
  if (pool.length) return { list: pool, changed: edited.length };
  const names = store.project.edition === 'java' ? SHOWCASE : SHOWCASE_BEDROCK;
  const list = names.map((n) => store.entries.find((e) => e.category === 'block' && e.name === n)).filter((e): e is TextureEntry => !!e);
  return { list, changed: 0 };
}

/** A block for the hero: the first full, opaque block texture, with its _top / _side partner faces. */
async function heroCube(store: TexStore, thumbs: ThumbService, list: TextureEntry[]): Promise<{ top: ImageData; side: ImageData; used: Set<string> } | null> {
  const sibling = (e: TextureEntry, name: string) => {
    const path = e.path.slice(0, e.path.length - e.name.length - e.ext.length - 1) + name + '.' + e.ext;
    return store.byPath.get(path) ?? null;
  };
  const tint = applyEffects(createImageData(1, 1, new Uint8ClampedArray([124, 189, 107, 255])), store.project.effects, {
    path: store.project.edition === 'java' ? 'assets/minecraft/textures/colormap/grass.png' : 'textures/colormap/grass.png',
    category: 'colormap',
  }).data;
  const face = async (e: TextureEntry | null) => {
    if (!e) return null;
    const img = await thumbs.get(e);
    if (!img) return null;
    const sq = square(img);
    // grass tops and the like are grey in the file: the game tints them
    return /grass|fern/.test(e.name) && isGrayscale(sq) ? multiply(sq, tint) : sq;
  };
  for (const e of list.slice(0, 24)) {
    if (e.category !== 'block' || /overlay|_bottom$|door|trapdoor|pane|rail|torch/.test(e.name)) continue;
    const self = await face(e);
    if (!self || coverage(self) < 0.92) continue;
    const base = e.name.replace(/_(top|side|front|end)$/, '');
    let top = self;
    let side = self;
    const used = new Set([e.path]);
    const pair = async (names: string[]) => {
      for (const n of names) {
        const s = sibling(e, n);
        if (!s || s.path === e.path) continue;
        const img = await face(s);
        if (img && coverage(img) >= 0.92) {
          used.add(s.path);
          return img;
        }
      }
      return null;
    };
    if (/_top$/.test(e.name)) side = (await pair([`${base}_side`, base])) ?? self;
    else if (/_side$/.test(e.name)) top = (await pair([`${base}_top`, base])) ?? self;
    else top = (await pair([`${e.name}_top`, `${base}_top`])) ?? self;
    return { top, side, used };
  }
  return null;
}

/** The scale that fits pixel art in a box: whole steps when it grows, so every texel is the same size. */
function fitScale(w: number, h: number, box: number): number {
  const k = box / Math.max(w, h);
  return k >= 1 ? Math.floor(k) : k;
}

function paintTile(ctx: CanvasRenderingContext2D, img: ImageData, x: number, y: number, s: number): void {
  fillRoundRect(ctx, x, y, s, s, 8, C.surface, C.border);
  const inner = s - 16;
  const k = fitScale(img.width, img.height, inner);
  const w = img.width * k;
  const h = img.height * k;
  drawPixels(ctx, img, x + (s - w) / 2, y + (s - h) / 2, w, h);
}

/** The PNG card for the pack in the editor. */
export async function makePackCard(store: TexStore, thumbs: ThumbService): Promise<{ blob: Blob; filename: string; title: string }> {
  const project = store.project;
  const name = project.name.trim() || te.untitled;
  const plainName = name.replace(/§./g, '');
  const desc = (project.description ?? '').trim();
  const { list, changed } = pickEntries(store);
  const version = versionLabel(project);
  const changedText = changed ? fmt(te.share.changed, { count: changed }) : '';
  await loadCardFonts([
    { font: cardFont(48, true), text: plainName },
    { font: cardFont(24), text: desc.replace(/§./g, '') + 'texturepackmaker.com' },
    { font: cardFont(16, true), text: te.texturePack },
    { font: cardFont(16), text: version + changedText + '+0123456789' },
  ]);
  await yieldToMain();

  // ---- what goes on it
  const hero = await heroCube(store, thumbs, list);
  await yieldToMain();
  const rest = list.filter((e) => !hero?.used.has(e.path));
  // with no block for the hero, the first texture is the hero, drawn flat
  const flatHero = hero ? null : (rest.shift() ?? null);
  const flatImg = flatHero ? await thumbs.get(flatHero) : null;
  const loaded: Tile[] = [];
  for (const e of spread(rest, 120)) {
    const img = await thumbs.get(e);
    if (img) loaded.push({ entry: e, img: square(img) });
  }
  // a few specks of colour (the parts of a bed, a bit of a plant) say little at this size
  const clear = loaded.filter((t) => coverage(t.img) >= 0.1);
  const pool = clear.length ? clear : loaded;
  // up to 9 in one row, a row with "+N" up to 17, then two full rows
  let tiles = pool;
  let rows = pool.length ? 1 : 0;
  if (pool.length > MAX_TWO_ROWS) {
    rows = 2;
    tiles = spread(pool, MAX_TWO_ROWS - 1);
  } else if (pool.length >= MAX_ONE_ROW * 2 + 2) rows = 2;
  else if (pool.length > MAX_ONE_ROW + 1) tiles = spread(pool, MAX_ONE_ROW);
  const heroUsed = hero ? [...hero.used].filter((p) => store.isEdited(p)).length : flatHero && changed ? 1 : 0;
  const more = Math.max(0, changed - tiles.length - heroUsed);
  const icon = await packIconImage(store).catch(() => null);
  await yieldToMain();

  // ---- layout: footer line, the strip above it, the header band above that
  const { canvas, ctx } = createCard();
  const footBase = CARD_H - CARD_PAD + 8;
  const count = tiles.length + (more ? 1 : 0);
  const gap = rows === 2 ? 12 : 16;
  const tile = rows === 2 ? 72 : Math.min(112, Math.floor((CARD_W - 2 * CARD_PAD - (count - 1) * gap) / Math.max(1, count)));
  const stripBottom = footBase - 56;
  const stripTop = stripBottom - (rows ? rows * tile + (rows - 1) * gap : 0);
  const bandBottom = rows ? stripTop - 32 : stripBottom;
  const heroSize = rows === 2 ? 288 : rows ? 336 : 400;
  const heroBox = Math.min(heroSize, bandBottom - CARD_PAD + 24);
  const heroX = CARD_W - CARD_PAD - heroBox + 8;
  const heroY = Math.max(CARD_PAD - 16, Math.round((CARD_PAD + bandBottom) / 2 - heroBox / 2));
  paintBackdrop(ctx, ACCENT, { x: heroX + heroBox / 2, y: heroY + heroBox / 2, r: heroBox * 0.95 });

  // ---- hero: the cube (with a shadow on the ground), or the first texture big and flat
  if (hero) {
    const cx = heroX + heroBox / 2;
    const ground = heroY + heroBox * 0.94;
    const sh = ctx.createRadialGradient(cx, ground, 0, cx, ground, heroBox * 0.42);
    sh.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
    sh.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.save();
    ctx.translate(cx, ground);
    ctx.scale(1, 0.22);
    ctx.translate(-cx, -ground);
    ctx.fillStyle = sh;
    ctx.fillRect(cx - heroBox, ground - heroBox, heroBox * 2, heroBox * 2);
    ctx.restore();
    drawPixels(ctx, renderIsoCube(hero.top, hero.side, heroBox), heroX, heroY, heroBox, heroBox);
  } else if (flatImg) {
    const img = square(flatImg);
    const box = Math.round(heroBox * 0.86);
    const bx = heroX + (heroBox - box) / 2;
    const by = heroY + (heroBox - box) / 2;
    fillRoundRect(ctx, bx, by, box, box, 16, withAlpha(C.surface, 0.9), C.borderStrong, 2);
    const k = fitScale(img.width, img.height, box - 48);
    drawPixels(ctx, img, bx + (box - img.width * k) / 2, by + (box - img.height * k) / 2, img.width * k, img.height * k);
  }

  // ---- header: icon, eyebrow, name, description
  const left = CARD_PAD;
  const iconSize = 128;
  const textX = left + iconSize + 32;
  const textW = heroX - 40 - textX;
  const nameBox: TextBox = { x: textX, y: 0, maxWidth: textW, size: 48, lineHeight: 56, maxLines: 2, bold: true, minSize: 40 };
  const descBox: TextBox = { x: textX, y: 0, maxWidth: textW, size: 24, lineHeight: 32, maxLines: rows === 2 ? 2 : 3 };
  const nameL = layoutText(ctx, mcRuns(name, C.text), nameBox);
  const descL = desc ? layoutText(ctx, mcRuns(desc, C.text2), descBox) : null;
  const eyebrowH = 24;
  const blockH = eyebrowH + 12 + nameL.height + (descL ? 16 + descL.height : 0);
  const top = Math.max(CARD_PAD, Math.round((CARD_PAD + bandBottom) / 2 - Math.max(blockH, iconSize) / 2));
  // the icon on a checkerboard, as in the editor's bar
  paintChecker(ctx, left, top, iconSize, iconSize, 12, 16);
  if (icon) {
    const img = icon.img;
    const k = fitScale(img.width, img.height, iconSize);
    const w = img.width * k;
    const h = img.height * k;
    if (k >= 1) drawPixels(ctx, img, left + (iconSize - w) / 2, top + (iconSize - h) / 2, w, h);
    else {
      // a big painted icon shrinks smoothly
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      c.getContext('2d')?.putImageData(img, 0, 0);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(c, left + (iconSize - w) / 2, top + (iconSize - h) / 2, w, h);
      ctx.restore();
    }
  }
  fillRoundRect(ctx, left, top, iconSize, iconSize, 12, 'rgba(0, 0, 0, 0)', 'rgba(255, 255, 255, 0.12)', 2);
  let y = top;
  ctx.font = cardFont(16, true);
  ctx.fillStyle = ACCENT;
  ctx.fillText(te.texturePack.toLocaleUpperCase(textLocale()), textX, y + 18);
  y += eyebrowH + 12;
  paintText(ctx, nameL, { ...nameBox, y }, { shadow: true });
  y += nameL.height;
  if (descL) paintText(ctx, descL, { ...descBox, y: y + 16 });

  // ---- the strip of changed textures
  if (rows) {
    const perRow = rows === 2 ? Math.ceil(count / 2) : count;
    const all: (Tile | 'more')[] = [...tiles, ...(more ? (['more'] as const) : [])];
    all.forEach((t, i) => {
      const r = Math.floor(i / perRow);
      const c = i % perRow;
      const x = left + c * (tile + gap);
      const ty = stripTop + r * (tile + gap);
      if (t === 'more') {
        fillRoundRect(ctx, x, ty, tile, tile, 8, withAlpha(ACCENT, 0.12), withAlpha(ACCENT, 0.5));
        ctx.save();
        ctx.font = cardFont(tile >= 96 ? 32 : 24, true);
        ctx.fillStyle = ACCENT;
        ctx.textAlign = 'center';
        ctx.fillText(`+${num(more)}`, x + tile / 2, ty + tile / 2 + (tile >= 96 ? 12 : 9));
        ctx.restore();
      } else paintTile(ctx, t.img, x, ty, tile);
    });
  }

  // ---- footer: version and count on the left, the site on the right
  let cx = left;
  cx += paintChip(ctx, version, cx, footBase - 24, ACCENT) + 12;
  if (changedText) paintChip(ctx, changedText, cx, footBase - 24, C.text2);
  paintCredit(ctx, CARD_W - CARD_PAD, footBase);

  await yieldToMain();
  const blob = await cardBlob(canvas);
  return { blob, filename: cardFileName(plainName, 'card', 'pack'), title: plainName };
}

/** Makes the card and shares or downloads it. */
export async function sharePackCard(store: TexStore, thumbs: ThumbService): Promise<{ result: 'shared' | 'saved' | 'cancelled'; filename: string }> {
  const card = await makePackCard(store, thumbs);
  return { result: await deliverCard(card.blob, card.filename, card.title), filename: card.filename };
}
