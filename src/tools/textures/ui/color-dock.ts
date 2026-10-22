// Colour dock under the canvas: primary / secondary swatches (click for the full picker), the
// texture's own palette and recently used colours.

import type { PixelCanvas } from '../../../shared/pixel-canvas';
import { h } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { openPopover, tooltip, type PopoverHandle } from '../../../ui/components';
import { addRecentColor, colorPicker, getRecentColors } from '../../../ui/color-picker';
import { parseHex } from '../../../ui/color';
import { extractPalette, rgbaHex, type RGBA } from './meta';
import { fmt } from '../../../i18n/editor-text';
import { te } from './i18n/editor';
import { isLandscapePhone } from './media';

export interface ColorDock {
  el: HTMLElement;
  /** The palette's horizontal scroller */
  scroller: HTMLElement;
  setPalette(img: ImageData | null): void;
  /** Sync swatches with the canvas settings */
  sync(): void;
  noteUsed(c: RGBA): void;
  destroy(): void;
}

const css = (c: RGBA) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${(c[3] / 255).toFixed(3)})`;

export function createColorDock(getCanvas: () => PixelCanvas | null): ColorDock {
  let palette: RGBA[] = [];
  let pop: PopoverHandle | null = null;

  const primary = h('button', { type: 'button', class: 'tx-swatch tx-swatch-primary checker', 'aria-haspopup': 'dialog' }, h('span', { class: 'tx-swatch-fill' }));
  const secondary = h('button', { type: 'button', class: 'tx-swatch tx-swatch-secondary checker', 'aria-haspopup': 'dialog' }, h('span', { class: 'tx-swatch-fill' }));
  const swap = h('button', { type: 'button', class: 'tx-swap', 'aria-label': te.canvas.swap }, icon('arrows-horizontal', { size: 16 }));
  tooltip(swap, te.canvas.swapKey);
  const swatches = h('div', { class: 'tx-swatches' }, secondary, primary, swap);

  const palRow = h('div', { class: 'tx-pal-row', role: 'list', 'aria-label': te.canvas.paletteLabel });
  const recentRow = h('div', { class: 'tx-pal-row', role: 'list', 'aria-label': te.canvas.recentLabel });
  const palGroup = h('div', { class: 'tx-pal-group' }, h('span', { class: 'tx-pal-label' }, te.canvas.inTexture), palRow);
  const recentGroup = h('div', { class: 'tx-pal-group' }, h('span', { class: 'tx-pal-label' }, te.canvas.recent), recentRow);

  const scroller = h('div', { class: 'tx-pal-scroll' }, palGroup, recentGroup);
  const el = h('div', { class: 'tx-colordock' }, swatches, scroller);

  const chip = (c: RGBA) => {
    const b = h(
      'button',
      { type: 'button', class: ['tx-pal', c[3] < 255 && 'checker'], role: 'listitem', 'aria-label': fmt(te.canvas.chip, { hex: rgbaHex(c) }), title: rgbaHex(c) },
      h('span', { style: { background: css(c) } }),
    );
    b.addEventListener('click', () => {
      getCanvas()?.setColor([...c] as RGBA);
      sync();
    });
    b.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      getCanvas()?.setSecondaryColor([...c] as RGBA);
      sync();
    });
    return b;
  };

  const renderPalette = () => {
    palRow.replaceChildren(...palette.map(chip));
    palGroup.hidden = palette.length === 0;
  };
  const renderRecent = () => {
    const list = getRecentColors()
      .map((hex) => parseHex(hex))
      .filter((c): c is RGBA => !!c)
      .slice(0, 16);
    recentRow.replaceChildren(...list.map(chip));
    recentGroup.hidden = list.length === 0;
  };

  function sync() {
    const pc = getCanvas();
    if (!pc) return;
    const p = pc.color as RGBA;
    const s = pc.secondaryColor as RGBA;
    (primary.firstChild as HTMLElement).style.background = css(p);
    (secondary.firstChild as HTMLElement).style.background = css(s);
    primary.setAttribute('aria-label', fmt(te.canvas.mainColour, { hex: rgbaHex(p) }));
    secondary.setAttribute('aria-label', fmt(te.canvas.secondColour, { hex: s[3] === 0 ? te.canvas.transparent : rgbaHex(s) }));
    const mark = rgbaHex(p);
    palRow.querySelectorAll<HTMLElement>('.tx-pal').forEach((b) => b.classList.toggle('selected', b.title === mark));
    recentRow.querySelectorAll<HTMLElement>('.tx-pal').forEach((b) => b.classList.toggle('selected', b.title === mark));
  }

  const openPicker = (which: 'primary' | 'secondary') => {
    const pc = getCanvas();
    if (!pc) return;
    const anchor = which === 'primary' ? primary : secondary;
    if (pop?.open) {
      pop.close();
      if (pop.el.dataset.which === which) return;
    }
    const picker = colorPicker({
      value: (which === 'primary' ? pc.color : pc.secondaryColor) as RGBA,
      palette: palette.length ? palette.slice(0, 24).map((c) => rgbaHex(c)) : undefined,
      onChange: (c) => {
        if (which === 'primary') pc.setColor(c);
        else pc.setSecondaryColor(c);
        sync();
      },
      onCommit: () => renderRecent(),
      onEyedropper: () => {
        pc.setTool('picker');
        pop?.close();
        pc.focus();
        return null;
      },
    });
    // (a phone held in landscape has no room above or below the colours: the picker goes beside them)
    pop = openPopover(anchor, picker, { placement: isLandscapePhone() ? 'right-start' : 'top-start', focus: true, label: which === 'primary' ? te.canvas.main : te.canvas.second, onClose: () => renderRecent() });
    pop.el.dataset.which = which;
  };
  primary.addEventListener('click', () => openPicker('primary'));
  secondary.addEventListener('click', () => openPicker('secondary'));
  swap.addEventListener('click', () => {
    getCanvas()?.swapColors();
    sync();
  });

  renderPalette();
  renderRecent();

  let lastUsed = '';
  return {
    el,
    scroller,
    setPalette(img) {
      palette = img ? extractPalette(img, 32) : [];
      renderPalette();
      sync();
    },
    sync,
    noteUsed(c) {
      const hex = rgbaHex(c);
      if (hex === lastUsed || c[3] === 0) return;
      lastUsed = hex;
      addRecentColor(c);
      renderRecent();
      sync();
    },
    destroy() {
      pop?.close();
    },
  };
}
