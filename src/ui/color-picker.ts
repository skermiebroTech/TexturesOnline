// HSV colour picker with alpha, hex input, eyedropper, palette and persisted recent colours.

import { h, uid } from './dom';
import { icon } from './icons';
import { tooltip } from './tooltip';
import { DEFAULT_PALETTE, hsvToRgb, parseHex, rgbToHsv, rgbaCss, rgbaEqual, toHex, type RGBA } from './color';

export type { RGBA } from './color';

const RECENT_KEY = 'to-recent-colors';
const RECENT_MAX = 16;
let recentCache: string[] | null = null;
const recentListeners = new Set<() => void>();

export function getRecentColors(): string[] {
  if (recentCache) return recentCache;
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    recentCache = Array.isArray(list) ? list.filter((c): c is string => typeof c === 'string' && parseHex(c) !== null).slice(0, RECENT_MAX) : [];
  } catch {
    recentCache = [];
  }
  return recentCache;
}

/** Remember a colour in the shared "recent" list (most recent first). */
export function addRecentColor(rgba: RGBA): void {
  const hex = toHex(rgba, true);
  const list = [hex, ...getRecentColors().filter((c) => c !== hex)].slice(0, RECENT_MAX);
  recentCache = list;
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked */
  }
  recentListeners.forEach((fn) => fn());
}

interface EyeDropperCtor {
  new (): { open(): Promise<{ sRGBHex: string }> };
}

export interface ColorPickerOptions {
  value: RGBA;
  onChange: (rgba: RGBA) => void;
  palette?: string[];
  /** Show alpha controls (default true) */
  alpha?: boolean;
  /** Render without the popover padding */
  inline?: boolean;
  /** Custom eyedropper (e.g. pick from the editor canvas). Defaults to the browser EyeDropper when available. */
  onEyedropper?: () => Promise<RGBA | null> | RGBA | null | void;
  /** Called when the user finishes an interaction (drag end, palette click, hex entered) */
  onCommit?: (rgba: RGBA) => void;
}

export function colorPicker(opts: ColorPickerOptions): HTMLElement & { setValue(rgba: RGBA): void } {
  const withAlpha = opts.alpha ?? true;
  let [hue, sat, val] = rgbToHsv(opts.value[0], opts.value[1], opts.value[2]);
  let alpha = opts.value[3];
  let current: RGBA = [...opts.value] as RGBA;
  const original: RGBA = [...opts.value] as RGBA;

  const svCursor = h('div', { class: 'cp-sv-cursor' });
  const sv = h('div', {
    class: 'cp-sv',
    tabIndex: 0,
    role: 'slider',
    'aria-label': 'Saturation and brightness',
    'aria-valuemin': 0,
    'aria-valuemax': 100,
  }, svCursor);

  const hueThumb = h('div', { class: 'cp-strip-thumb' });
  const hueStrip = h('div', {
    class: 'cp-strip',
    tabIndex: 0,
    role: 'slider',
    'aria-label': 'Hue',
    'aria-valuemin': 0,
    'aria-valuemax': 360,
    style: { background: 'linear-gradient(to right, #f00, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00)' },
  }, hueThumb);

  const alphaFill = h('div', { class: 'cp-strip-fill' });
  const alphaThumb = h('div', { class: 'cp-strip-thumb' });
  const alphaStrip = h('div', {
    class: 'cp-strip checker',
    tabIndex: 0,
    role: 'slider',
    'aria-label': 'Opacity',
    'aria-valuemin': 0,
    'aria-valuemax': 100,
  }, alphaFill, alphaThumb);

  const prevOld = h('span', { title: 'Previous' });
  const prevNew = h('span', { title: 'New' });
  const preview = h('div', { class: 'cp-preview checker' }, prevOld, prevNew);

  const hexId = uid('hex');
  const hexInput = h('input', {
    class: 'input cp-hex',
    id: hexId,
    type: 'text',
    spellcheck: false,
    autocomplete: 'off',
    maxLength: withAlpha ? 9 : 7,
    'aria-label': 'Hex colour',
  });
  const alphaInput = h('input', {
    class: 'input cp-alpha-input',
    type: 'number',
    min: 0,
    max: 100,
    step: 1,
    'aria-label': 'Opacity percent',
  });

  const EyeDropper = (globalThis as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper;
  const canPick = Boolean(opts.onEyedropper || EyeDropper);
  const pickBtn = canPick
    ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Pick a colour from the screen' }, icon('pipette'))
    : null;
  if (pickBtn) tooltip(pickBtn, 'Eyedropper');

  const paletteGrid = h('div', { class: 'cp-swatches', role: 'list' });
  const recentGrid = h('div', { class: 'cp-swatches', role: 'list' });
  const recentWrap = h('div', { class: 'stack', style: { '--gap': '6px' } }, h('div', { class: 'cp-label' }, 'Recent'), recentGrid);

  const root = h(
    'div',
    { class: ['color-picker', opts.inline && 'inline'] },
    sv,
    hueStrip,
    withAlpha ? alphaStrip : null,
    h('div', { class: 'cp-row' }, preview, hexInput, withAlpha ? alphaInput : null, pickBtn),
    h('div', { class: 'stack', style: { '--gap': '6px' } }, h('div', { class: 'cp-label' }, 'Palette'), paletteGrid),
    recentWrap,
  ) as unknown as HTMLElement & { setValue(rgba: RGBA): void };

  const swatch = (hex: string) => {
    const c = parseHex(hex);
    if (!c) return null;
    return h(
      'button',
      {
        type: 'button',
        class: ['cp-swatch', c[3] < 255 && 'checker'],
        role: 'listitem',
        'aria-label': toHex(c, true),
        dataset: { hex: toHex(c, true) },
        on: {
          click: () => {
            setFromRgba(c, true);
            commit();
          },
        },
      },
      h('span', { class: 'cp-swatch-fill', style: { background: rgbaCss(c) } }),
    );
  };

  const renderPalette = () => {
    paletteGrid.replaceChildren(...(opts.palette ?? DEFAULT_PALETTE).map(swatch).filter((x): x is HTMLButtonElement => x !== null));
  };
  const renderRecent = () => {
    const list = getRecentColors();
    recentWrap.hidden = list.length === 0;
    recentGrid.replaceChildren(...list.map(swatch).filter((x): x is HTMLButtonElement => x !== null));
    markSelected();
  };
  const markSelected = () => {
    const hex = toHex(current, true);
    root.querySelectorAll<HTMLElement>('.cp-swatch').forEach((el) => el.classList.toggle('selected', el.dataset.hex === hex));
  };

  function sync(fromHexInput = false) {
    const [r, g, b] = hsvToRgb(hue, sat, val);
    current = [r, g, b, withAlpha ? alpha : 255];
    sv.style.background = `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))`;
    svCursor.style.left = `${sat * 100}%`;
    svCursor.style.top = `${(1 - val) * 100}%`;
    svCursor.style.background = toHex(current);
    sv.setAttribute('aria-valuenow', String(Math.round(sat * 100)));
    sv.setAttribute('aria-valuetext', `Saturation ${Math.round(sat * 100)}%, brightness ${Math.round(val * 100)}%`);
    hueThumb.style.left = `${(hue / 360) * 100}%`;
    hueThumb.style.background = `hsl(${hue}, 100%, 50%)`;
    hueStrip.setAttribute('aria-valuenow', String(Math.round(hue)));
    alphaFill.style.background = `linear-gradient(to right, transparent, ${toHex(current)})`;
    alphaThumb.style.left = `${(alpha / 255) * 100}%`;
    alphaStrip.setAttribute('aria-valuenow', String(Math.round((alpha / 255) * 100)));
    prevOld.style.background = rgbaCss(original);
    prevNew.style.background = rgbaCss(current);
    if (!fromHexInput) hexInput.value = toHex(current, withAlpha);
    if (document.activeElement !== alphaInput) alphaInput.value = String(Math.round((alpha / 255) * 100));
    markSelected();
  }

  const emit = () => opts.onChange([...current] as RGBA);
  const commit = () => {
    addRecentColor(current);
    opts.onCommit?.([...current] as RGBA);
  };

  function setFromRgba(c: RGBA, notify: boolean) {
    const [nh, ns, nv] = rgbToHsv(c[0], c[1], c[2]);
    if (ns > 0 && nv > 0) hue = nh;
    sat = ns;
    val = nv;
    alpha = withAlpha ? c[3] : 255;
    sync();
    if (notify) emit();
  }

  // Dragging helpers
  const drag = (el: HTMLElement, onMove: (x: number, y: number) => void) => {
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      el.focus({ preventScroll: true });
      el.setPointerCapture(e.pointerId);
      const move = (ev: PointerEvent) => {
        const r = el.getBoundingClientRect();
        onMove(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)));
      };
      move(e);
      const up = () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        commit();
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
  };
  drag(sv, (x, y) => {
    sat = x;
    val = 1 - y;
    sync();
    emit();
  });
  drag(hueStrip, (x) => {
    hue = x * 360;
    sync();
    emit();
  });
  drag(alphaStrip, (x) => {
    alpha = Math.round(x * 255);
    sync();
    emit();
  });

  const keyStep = (e: KeyboardEvent, big: number, small: number) => (e.shiftKey ? big : small);
  sv.addEventListener('keydown', (e) => {
    const st = keyStep(e, 0.1, 0.02);
    let handled = true;
    if (e.key === 'ArrowLeft') sat = Math.max(0, sat - st);
    else if (e.key === 'ArrowRight') sat = Math.min(1, sat + st);
    else if (e.key === 'ArrowUp') val = Math.min(1, val + st);
    else if (e.key === 'ArrowDown') val = Math.max(0, val - st);
    else handled = false;
    if (handled) {
      e.preventDefault();
      sync();
      emit();
    }
  });
  sv.addEventListener('keyup', (e) => {
    if (e.key.startsWith('Arrow')) commit();
  });
  hueStrip.addEventListener('keydown', (e) => {
    const st = keyStep(e, 30, 5);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') hue = (hue - st + 360) % 360;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') hue = (hue + st) % 360;
    else return;
    e.preventDefault();
    sync();
    emit();
  });
  alphaStrip.addEventListener('keydown', (e) => {
    const st = keyStep(e, 32, 8);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') alpha = Math.max(0, alpha - st);
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') alpha = Math.min(255, alpha + st);
    else return;
    e.preventDefault();
    sync();
    emit();
  });

  hexInput.addEventListener('input', () => {
    const c = parseHex(hexInput.value);
    if (!c) return;
    if (!withAlpha) c[3] = 255;
    const [nh, ns, nv] = rgbToHsv(c[0], c[1], c[2]);
    if (ns > 0 && nv > 0) hue = nh;
    sat = ns;
    val = nv;
    alpha = c[3];
    sync(true);
    emit();
  });
  hexInput.addEventListener('change', () => {
    sync();
    commit();
  });
  hexInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sync();
      commit();
    }
  });
  alphaInput.addEventListener('input', () => {
    const n = Number(alphaInput.value);
    if (!Number.isFinite(n)) return;
    alpha = Math.round((Math.min(100, Math.max(0, n)) / 100) * 255);
    sync();
    emit();
  });
  alphaInput.addEventListener('change', () => {
    alphaInput.value = String(Math.round((alpha / 255) * 100));
    commit();
  });

  pickBtn?.addEventListener('click', async () => {
    try {
      let picked: RGBA | null = null;
      if (opts.onEyedropper) {
        picked = (await opts.onEyedropper()) ?? null;
      } else if (EyeDropper) {
        const res = await new EyeDropper().open();
        picked = parseHex(res.sRGBHex);
      }
      if (picked) {
        if (withAlpha && !opts.onEyedropper) picked[3] = alpha;
        setFromRgba(picked, true);
        commit();
      }
    } catch {
      /* cancelled */
    }
  });

  const onRecent = () => {
    if (!root.isConnected) {
      recentListeners.delete(onRecent);
      return;
    }
    renderRecent();
  };
  recentListeners.add(onRecent);

  root.setValue = (rgba: RGBA) => {
    if (rgbaEqual(rgba, current)) return;
    setFromRgba(rgba, false);
  };

  renderPalette();
  renderRecent();
  sync();
  return root;
}
