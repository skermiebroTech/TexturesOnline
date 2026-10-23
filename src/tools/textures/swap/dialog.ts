// The colour swap window: the colour to replace (from the texture's own colours or the picker) and
// the new one, a tolerance for similar colours, the whole shade ramp optionally, and where: the open
// texture, the selection or every texture of the pack that uses the colour (listed with before /
// after pictures, each can be left out). Across the pack it is one undo step (CanvasPanel.applyBatch).

import './swap.css';
import type { TexStore } from '../ui/store';
import type { BatchChange, CanvasPanel, TexState } from '../ui/canvas-panel';
import { h } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { iconButton, openPopover, segmented, slider, toggle, tooltip, type PopoverHandle } from '../../../ui/components';
import { openModal } from '../../../ui/modal';
import { toast } from '../../../ui/toast';
import { colorPicker } from '../../../ui/color-picker';
import { cloneImageData } from '../../../core/pixels';
import { fmt } from '../../../i18n/editor-text';
import { kit } from '../../../ui/i18n/kit';
import { ICON_KEY } from '../ui/store';
import { extractPalette, firstSquare, getFrame, rgbaHex } from '../ui/meta';
import { paintCanvas } from '../ui/thumbs';
import { te } from '../ui/i18n/editor';
import { byPointer } from '../ui/media';
import { copyStack, flatten, type LayerStack } from '../layers/stack';
import { countSwapped, rampPairs, shadeRamp, swapImage, TOLERANCE_MAX, type RGBA, type SwapPair } from './swap';
import { tw } from './i18n/text';

type Scope = 'texture' | 'selection' | 'pack';

export interface SwapDialogOptions {
  store: TexStore;
  canvas: CanvasPanel;
  /** The colour to replace at first (else the main colour) */
  from?: RGBA;
}

interface Row {
  path: string;
  name: string;
  count: number;
  el: HTMLElement;
  check: HTMLInputElement;
}

const css = (c: RGBA) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${(c[3] / 255).toFixed(3)})`;
const isTexture = (p: string) => p !== ICON_KEY && /\.(png|tga)$/i.test(p);

export function openSwapDialog(o: SwapDialogOptions): void {
  const { store, canvas } = o;
  const t = canvas.current();
  const pc = canvas.canvas();
  if (!t || !pc) return;
  const shownFrame = (): ImageData => getFrame(t.full, t.anim, t.frame);
  const palette = extractPalette(shownFrame(), 32);
  let from: RGBA = o.from ?? (pc.color as RGBA);
  let to: RGBA = (pc.secondaryColor as RGBA)[3] ? (pc.secondaryColor as RGBA) : (pc.color as RGBA);
  // a sensible start: replace a colour of the texture, with a different one
  if (!o.from && palette.length && !palette.some((c) => c.join() === from.join())) from = palette[Math.floor(palette.length / 2)];
  if (to.join() === from.join()) to = [255 - from[0], 255 - from[1], 255 - from[2], 255];
  let tolerance = 0;
  let ramp = false;
  const sel = pc.getSelection();
  let scope: Scope = sel ? 'selection' : 'texture';
  let gameToo = false;

  const pairs = (): SwapPair[] => (ramp ? rampPairs(shadeRamp(from, palette), from, to) : [{ from, to }]);

  // ---------------------------------------------------------------- the colours
  let pop: PopoverHandle | null = null;
  const swatch = (which: 'from' | 'to') => {
    const fill = h('span', { class: 'tx-sw-fill' });
    const hex = h('span', { class: 'tx-sw-hex' });
    const b = h('button', { type: 'button', class: 'tx-sw-swatch', 'aria-haspopup': 'dialog' }, h('span', { class: 'tx-sw-chip checker' }, fill), h('span', { class: 'tx-sw-text' }, h('span', { class: 'tx-sw-label' }, which === 'from' ? tw.from : tw.to), hex));
    b.addEventListener('click', () => {
      if (pop?.open) {
        pop.close();
        if (pop.el.dataset.which === which) return;
      }
      const picker = colorPicker({
        value: which === 'from' ? from : to,
        palette: palette.slice(0, 24).map((c) => rgbaHex(c)),
        onChange: (c) => {
          if (which === 'from') from = c;
          else to = c;
          changed();
        },
      });
      pop = openPopover(b, picker, { placement: 'bottom-start', focus: true, label: which === 'from' ? tw.from : tw.to });
      pop.el.dataset.which = which;
    });
    return { el: b, paint: (c: RGBA) => ((fill.style.background = css(c)), (hex.textContent = rgbaHex(c).toUpperCase())) };
  };
  const fromSw = swatch('from');
  const toSw = swatch('to');
  const exchange = iconButton('switch', tw.exchange, () => {
    [from, to] = [to, from];
    changed();
  }, { size: 'sm', class: 'tx-sw-exchange' });
  const chips = palette.map((c) => {
    const b = h('button', { type: 'button', class: ['tx-pal', 'tx-sw-pal', c[3] < 255 && 'checker'], 'aria-label': fmt(te.canvas.chip, { hex: rgbaHex(c) }), title: rgbaHex(c) }, h('span', { style: { background: css(c) } }));
    b.addEventListener('click', () => {
      from = [...c] as RGBA;
      changed();
    });
    return b;
  });
  const chipRow = h('div', { class: 'tx-sw-chips', role: 'group', 'aria-label': tw.pickFrom }, chips);

  const tolSlider = slider({
    label: tw.tolerance,
    min: 0,
    max: TOLERANCE_MAX,
    step: 1,
    value: tolerance,
    description: tw.toleranceHint,
    onInput: (v) => {
      tolerance = v;
      changed();
    },
  });
  const rampToggle = toggle({ label: tw.ramp, value: ramp, description: tw.rampHint, onChange: (v) => ((ramp = v), changed()) });
  const rampRow = h('div', { class: 'tx-sw-ramp', hidden: true });

  const scopeSeg = segmented<Scope>({
    value: scope,
    size: 'sm',
    label: tw.where,
    options: [
      { value: 'texture', label: tw.scope.texture },
      ...(sel ? [{ value: 'selection' as Scope, label: tw.scope.selection }] : []),
      { value: 'pack', label: tw.scope.pack },
    ],
    onChange: (v) => {
      scope = v;
      changed();
    },
  });
  const scopeNote = h('p', { class: 'faint small tx-sw-note', hidden: true });

  // ---------------------------------------------------------------- preview
  const beforeC = h('canvas', { class: 'tx-sw-pic pixelated', 'aria-hidden': 'true' });
  const afterC = h('canvas', { class: 'tx-sw-pic pixelated', 'aria-hidden': 'true' });
  const countLine = h('p', { class: 'tx-sw-count', 'aria-live': 'polite' });
  const preview = h(
    'div',
    { class: 'tx-sw-preview' },
    h('figure', { class: 'tx-sw-fig' }, h('span', { class: 'tx-sw-picbox checker' }, beforeC), h('figcaption', null, tw.before)),
    icon('arrow-right', { class: 'tx-sw-arrow' }),
    h('figure', { class: 'tx-sw-fig' }, h('span', { class: 'tx-sw-picbox checker' }, afterC), h('figcaption', null, tw.after)),
  );

  // ---------------------------------------------------------------- the whole pack
  const gameToggle = toggle({ label: tw.gameToo, value: gameToo, onChange: (v) => ((gameToo = v), changed()) });
  const progress = h('p', { class: 'faint small tx-sw-progress', hidden: true });
  const list = h('ul', { class: 'tx-sw-list' });
  const packBox = h('div', { class: 'tx-sw-pack', hidden: true }, h('p', { class: 'tx-sw-note' }, tw.packNote), gameToggle, progress, list);
  let rows: Row[] = [];

  const body = h(
    'div',
    { class: 'tx-sw' },
    h('div', { class: 'tx-sw-colours' }, fromSw.el, exchange, toSw.el),
    chips.length ? h('div', { class: 'tx-sw-pick' }, h('span', { class: 'faint small' }, tw.pickFrom), chipRow) : null,
    tolSlider,
    h('div', { class: 'tx-sw-rampbox' }, rampToggle, rampRow),
    h('div', { class: 'tx-sw-where' }, h('span', { class: 'tx-sw-wherelabel' }, tw.where), scopeSeg),
    scopeNote,
    preview,
    countLine,
    packBox,
  );

  /** The open texture's shown frame swapped as the scope says (for the preview and the count) */
  function previewImages(ps: SwapPair[]) {
    const img = shownFrame();
    const rect = scope === 'selection' ? pc!.getSelection() : null;
    const r = swapImage(img, ps, tolerance, { rect });
    // (the whole texture changes: every frame counts)
    const changed = scope === 'texture' && t!.anim ? countSwapped(t!.full, ps, tolerance) : r.changed;
    return { before: img, after: r.image, changed };
  }

  function paintRamp(ps: SwapPair[]) {
    rampRow.hidden = !ramp;
    if (!ramp) return;
    const sw = (c: RGBA) => {
      const s = h('span', { class: 'tx-sw-rampchip', style: { background: css(c) } });
      tooltip(s, rgbaHex(c).toUpperCase());
      return s;
    };
    rampRow.replaceChildren(
      h('span', { class: 'tx-sw-rampline' }, ps.map((p) => sw(p.from))),
      icon('arrow-right', { size: 16 }),
      h('span', { class: 'tx-sw-rampline' }, ps.map((p) => sw(p.to))),
      h('span', { class: 'faint small' }, fmt(tw.rampShades, { count: ps.length })),
    );
  }

  // ---------------------------------------------------------------- scanning the pack
  let scanToken = 0;
  let scanTimer: ReturnType<typeof setTimeout> | null = null;
  function scanSoon() {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(() => void scan(), 250);
  }

  async function imageOf(path: string): Promise<ImageData | null> {
    if (path === t!.key) return t!.full;
    try {
      return await store.getFull(path);
    } catch {
      return null;
    }
  }

  async function scan() {
    const my = ++scanToken;
    const ps = pairs();
    const paths = new Set<string>([t!.key, ...[...store.editedPaths()].filter(isTexture)]);
    if (gameToo) for (const e of store.entries) if (isTexture(e.path)) paths.add(e.path);
    const all = [...paths].filter(isTexture);
    const found: Row[] = [];
    // (the list fills in as the textures are looked through)
    rows = found;
    list.replaceChildren();
    progress.hidden = all.length < 40;
    paintApply();
    for (let i = 0; i < all.length; i++) {
      if (my !== scanToken || !open) return;
      if (i % 24 === 0) {
        progress.textContent = fmt(tw.searching, { done: i, total: all.length });
        await new Promise((r) => setTimeout(r, 0));
        if (my !== scanToken) return;
      }
      const path = all[i];
      const img = await imageOf(path);
      if (!img || my !== scanToken) continue;
      const n = countSwapped(img, ps, tolerance);
      if (!n) continue;
      const row = makeRow(path, img, ps, n);
      found.push(row);
      list.appendChild(row.el);
      paintApply();
    }
    if (my !== scanToken) return;
    progress.hidden = true;
    if (!found.length) list.replaceChildren(h('li', { class: 'faint small tx-sw-none' }, tw.none));
    paintApply();
  }

  function makeRow(path: string, img: ImageData, ps: SwapPair[], count: number): Row {
    const name = store.byPath.get(path)?.pretty ?? path.slice(path.lastIndexOf('/') + 1);
    const sq = firstSquare(img);
    const a = h('canvas', { class: 'tx-sw-thumb pixelated', 'aria-hidden': 'true' });
    const b = h('canvas', { class: 'tx-sw-thumb pixelated', 'aria-hidden': 'true' });
    paintCanvas(a, sq);
    paintCanvas(b, swapImage(sq, ps, tolerance).image);
    const check = h('input', { type: 'checkbox', class: 'tx-sw-check', checked: true, 'aria-label': fmt(tw.include, { name }) });
    check.addEventListener('change', () => paintApply());
    const el = h(
      'li',
      { class: 'tx-sw-row', dataset: { path } },
      h(
        'label',
        { class: 'tx-sw-rowlabel' },
        check,
        h('span', { class: 'tx-sw-thumbbox checker' }, a),
        icon('arrow-right', { size: 16 }),
        h('span', { class: 'tx-sw-thumbbox checker' }, b),
        h('span', { class: 'tx-sw-rowtext' }, h('span', { class: 'tx-sw-rowname truncate' }, name), h('span', { class: 'faint small' }, fmt(tw.rowPixels, { count }))),
      ),
    );
    el.title = path;
    return { path, name, count, el, check };
  }

  // ---------------------------------------------------------------- updating
  let applyBtn: HTMLButtonElement | null = null;
  function paintApply() {
    if (!applyBtn) return;
    const label = applyBtn.querySelector('.btn-label') ?? applyBtn;
    if (scope === 'pack') {
      const n = rows.filter((r) => r.check.checked).length;
      label.textContent = fmt(tw.applyCount, { count: n });
      applyBtn.disabled = n === 0;
    } else {
      label.textContent = tw.apply;
      applyBtn.disabled = previewCount === 0;
    }
  }

  let previewCount = 0;
  function changed() {
    fromSw.paint(from);
    toSw.paint(to);
    for (const b of chips) b.classList.toggle('selected', b.title === rgbaHex(from));
    const ps = pairs();
    paintRamp(ps);
    const p = previewImages(ps);
    previewCount = p.changed;
    paintCanvas(beforeC, p.before);
    paintCanvas(afterC, p.after);
    // whole pixels where they fit, the picture's own shape
    const box = matchMedia('(max-width: 480px)').matches ? 104 : 128;
    const big = Math.max(p.before.width, p.before.height);
    const scale = big <= box ? Math.floor(box / big) : box / big;
    for (const c of [beforeC, afterC]) {
      c.style.width = `${Math.round(p.before.width * scale)}px`;
      c.style.height = `${Math.round(p.before.height * scale)}px`;
    }
    countLine.textContent = fmt(tw.pixels, { count: p.changed });
    const layered = !!t!.layers && !t!.layers.plain;
    scopeNote.hidden = !(scope === 'selection' || (layered && scope !== 'pack'));
    scopeNote.textContent = scope === 'selection' ? tw.selectionNote : tw.layersNote;
    packBox.hidden = scope !== 'pack';
    countLine.hidden = scope === 'pack';
    if (scope === 'pack') scanSoon();
    paintApply();
  }

  // ---------------------------------------------------------------- applying
  const swapStack = (s: LayerStack, ps: SwapPair[]): LayerStack => ({ layers: s.layers.map((l) => (l.locked ? { ...l } : { ...l, image: swapImage(l.image, ps, tolerance).image })), active: s.active });

  async function stateOf(path: string): Promise<TexState | null> {
    if (path === t!.key) {
      const s = t!.layers && !t!.layers.plain ? copyStack(t!.layers.stack) : null;
      // (the pack icon is the pack's own picture whatever it shows)
      return { full: cloneImageData(t!.full), layers: s, edited: path === ICON_KEY || store.isEdited(path) };
    }
    const full = await imageOf(path);
    if (!full) return null;
    const layers = store.hasLayers(path) ? await store.loadLayers(path).catch(() => null) : null;
    return { full: cloneImageData(full), layers: layers ? copyStack(layers) : null, edited: store.isEdited(path) };
  }

  async function changeOf(path: string, ps: SwapPair[]): Promise<BatchChange | null> {
    const before = await stateOf(path);
    if (!before) return null;
    let after: TexState;
    if (before.layers) {
      const layers = swapStack(before.layers, ps);
      after = { full: flatten(layers), layers, edited: true };
    } else after = { full: swapImage(before.full, ps, tolerance).image, layers: null, edited: true };
    const same = after.full.data.every((v, i) => v === before.full.data[i]);
    return same ? null : { path, before, after };
  }

  async function apply(): Promise<boolean> {
    const ps = pairs();
    const name = t!.name;
    if (scope === 'selection') {
      const a = t!.layers?.active;
      if (a && (a.locked || a.hidden)) {
        toast(tw.locked, { tone: 'info' });
        return false;
      }
      pc!.applyFilter((img) => swapImage(img, ps, tolerance).image);
      toast(fmt(byPointer(te.canvas.undoHint, te.canvas.undoHintTouch), { action: fmt(tw.done, { name }) }), { tone: 'success' });
      return true;
    }
    const paths = scope === 'pack' ? rows.filter((r) => r.check.checked).map((r) => r.path) : [t!.key];
    const changes: BatchChange[] = [];
    for (const p of paths) {
      const c = await changeOf(p, ps);
      if (c) changes.push(c);
    }
    if (!changes.length) {
      toast(tw.nothing, { tone: 'info' });
      return false;
    }
    canvas.applyBatch(changes, changes.length === 1 && changes[0].path === t!.key ? fmt(tw.done, { name }) : fmt(tw.doneMany, { count: changes.length }));
    return true;
  }

  let open = true;
  const modal = openModal({
    title: tw.title,
    body,
    width: 560,
    class: 'tx-sw-modal',
    initialFocus: fromSw.el,
    onClose: () => {
      open = false;
      scanToken++;
      if (scanTimer) clearTimeout(scanTimer);
      pop?.close();
    },
    actions: [
      { label: kit.cancel, variant: 'ghost' },
      { label: tw.apply, variant: 'primary', onClick: () => apply() },
    ],
  });
  applyBtn = modal.el.querySelector<HTMLButtonElement>('.btn-primary');
  changed();
}
