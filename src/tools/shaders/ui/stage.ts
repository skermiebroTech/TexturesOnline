// Center preview stage: live 3D preview, time of day, auto-rotate, compare, screenshot and the
// preview textures (the real game textures by default, see texture-picker.ts).

import type { Edition, PreviewParams } from '../../../core/types';
import type { ShaderPreview } from '../../../shared/preview/shader-preview';
import { iconButton, tooltip } from '../../../ui/components';
import { h, prefersReducedMotion } from '../../../ui/dom';
import { icon, type IconName } from '../../../ui/icons';
import { toast } from '../../../ui/toast';
import { friendlyError } from '../../../core/net';
import type { PreviewTexturesPref, ShaderPrefs } from './project';
import { createTexturePicker } from './texture-picker';
import { et } from './i18n/editor';
import { fmt } from '../../../i18n/editor-text';

type TimeId = keyof typeof et.stage.times;

const time = (id: TimeId, icon: IconName, tick: number, key: string) => ({
  id,
  get label() {
    return et.stage.times[id];
  },
  icon,
  tick,
  key,
});

export const TIME_PRESETS: { id: string; readonly label: string; icon: IconName; tick: number; key: string }[] = [
  time('sunrise', 'cloud-sun', 400, '1'),
  time('noon', 'sun', 6000, '2'),
  time('sunset', 'cloud-moon', 11700, '3'),
  time('night', 'moon', 18000, '4'),
];

/** Minecraft ticks as a clock (tick 0 is 06:00). */
export function clockLabel(tick: number): string {
  const t = ((tick % 24000) + 24000) % 24000;
  const hours = (t / 1000 + 6) % 24;
  const hh = Math.floor(hours);
  const mm = Math.floor((hours - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export interface Stage {
  el: HTMLElement;
  /** Creates the WebGL preview (call once the element is in the document) */
  mount(): Promise<void>;
  /** Push the current parameters to the preview on the next frame */
  update(): void;
  /** Game version of the vanilla preview textures */
  setTexturesSource(edition: Edition, version: string): void;
  /** Opens the preview textures menu */
  openTexturesMenu(): void;
  setTime(tick: number): void;
  setDayAnimation(on: boolean): void;
  toggleDayAnimation(): void;
  toggleAutoRotate(): void;
  setCompare(on: boolean): void;
  resetCamera(): void;
  /** Screenshot of the current look (without compare), or null when the preview can't render */
  capture(): Promise<Blob | null>;
  saveScreenshot(): Promise<void>;
  destroy(): void;
}

export function createStage(opts: {
  params: () => PreviewParams;
  compareParams: () => PreviewParams;
  compareLabel: string;
  edition: Edition;
  /** Game version of the vanilla preview textures */
  version: string;
  textures: PreviewTexturesPref;
  onTexturesChange: (pref: PreviewTexturesPref) => void;
  prefs: ShaderPrefs;
  onPrefsChange: () => void;
  screenshotName: () => string;
  onScreenshot: (blob: Blob, name: string) => void;
}): Stage {
  const prefs = opts.prefs;
  const reduced = prefersReducedMotion();
  let preview: ShaderPreview | null = null;
  let destroyed = false;
  let tod = prefs.timeOfDay;
  let comparing = false;
  let raf = 0;
  let clockRaf = 0;
  let lastClock = 0;
  let resolvePreview: (p: ShaderPreview | null) => void = () => {};
  const previewReady = new Promise<ShaderPreview | null>((r) => (resolvePreview = r));

  // ---- view
  const host = h('div', { class: 'sh-stage-host' });
  const compareBadge = h('div', { class: 'sh-compare-badge', hidden: true, role: 'status' }, icon('eye-off'), h('span', null, opts.compareLabel));
  const hint = h('div', { class: 'sh-stage-chip sh-stage-hint' }, icon('info'), h('span', null, et.stage.live));
  tooltip(hint, et.stage.liveTip);
  hint.tabIndex = 0;

  const rotateBtn = iconButton('reload', et.stage.rotate, () => toggleAutoRotate(), { active: prefs.autoRotate && !reduced });
  const resetBtn = iconButton('target', et.stage.resetView, () => resetCamera());
  const shotBtn = iconButton('camera', et.stage.screenshot, () => void saveScreenshot());
  const viewTools = h('div', { class: 'sh-stage-tools' }, rotateBtn, resetBtn, shotBtn);

  const compareBtn = h('button', { type: 'button', class: 'sh-compare-btn', 'aria-pressed': 'false' }, icon('eye'), h('span', null, et.stage.compare));
  tooltip(compareBtn, fmt(et.stage.compareTip, { label: opts.compareLabel }));
  const endCompare = () => setCompare(false);
  compareBtn.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    compareBtn.setPointerCapture?.(e.pointerId);
    setCompare(true);
  });
  compareBtn.addEventListener('pointerup', endCompare);
  compareBtn.addEventListener('pointercancel', endCompare);
  compareBtn.addEventListener('lostpointercapture', endCompare);
  compareBtn.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      setCompare(true);
    }
  });
  compareBtn.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Enter') endCompare();
  });
  compareBtn.addEventListener('blur', endCompare);
  compareBtn.addEventListener('contextmenu', (e) => e.preventDefault());

  const view = h('div', { class: 'sh-stage-view' }, host, compareBadge);
  const textures = createTexturePicker({
    edition: opts.edition,
    version: opts.version,
    pref: opts.textures,
    onPrefChange: opts.onTexturesChange,
    // the base textures start downloading right away; they are shown once the preview exists
    apply: async (a) => {
      const p = await previewReady;
      return p && !destroyed ? p.setAssets(a) : null;
    },
    dropTarget: view,
  });
  view.append(
    h('div', { class: 'sh-stage-overlay tl' }, hint),
    h('div', { class: 'sh-stage-overlay tr' }, viewTools),
    // one row, so the textures control shrinks (its label truncates) instead of overlapping compare
    h('div', { class: 'sh-stage-overlay bottom' }, textures.el, compareBtn),
    textures.dropHint,
  );

  // ---- time bar
  const timeButtons = TIME_PRESETS.map((t) => {
    const b = h('button', { type: 'button', class: 'sh-time-btn', dataset: { time: t.id }, 'aria-pressed': 'false' }, icon(t.icon), h('span', null, t.label));
    tooltip(b, `${t.label} (${t.key})`);
    b.addEventListener('click', () => setTime(t.tick));
    return b;
  });
  const range = h('input', {
    type: 'range',
    class: 'range sh-time-range',
    min: '0',
    max: '23900',
    step: '100',
    'aria-label': et.stage.timeOfDay,
  });
  const clock = h('output', { class: 'sh-clock', 'aria-hidden': 'true' });
  range.addEventListener('input', () => setTime(Number(range.value), false));
  const playBtn = iconButton('play', et.stage.play, () => toggleDayAnimation(), { active: false });
  playBtn.classList.add('sh-play');
  const timebar = h(
    'div',
    { class: 'sh-timebar' },
    h('div', { class: 'sh-time-presets', role: 'group', 'aria-label': et.stage.timeOfDay }, timeButtons),
    h('div', { class: 'sh-time-slider' }, range, clock),
    playBtn,
  );

  const el = h('section', { class: 'panel sh-stage', 'aria-label': et.stage.live }, view, timebar);

  function paintTime(t: number): void {
    const v = String(Math.round(t / 100) * 100 % 24000);
    if (range.value !== v) range.value = v;
    range.setAttribute('aria-valuetext', clockLabel(t));
    clock.textContent = clockLabel(t);
    for (const [i, b] of timeButtons.entries()) {
      let d = Math.abs(t - TIME_PRESETS[i].tick);
      d = Math.min(d, 24000 - d);
      b.setAttribute('aria-pressed', String(d < 350 && !prefs.animateDay));
    }
  }

  function currentParams(): PreviewParams {
    const base = comparing ? opts.compareParams() : opts.params();
    return { ...base, timeOfDay: tod };
  }

  function update(): void {
    if (raf || destroyed) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      preview?.setParams(currentParams());
    });
  }

  function setTime(tick: number, pushPrefs = true): void {
    tod = ((tick % 24000) + 24000) % 24000;
    paintTime(tod);
    update();
    if (pushPrefs) {
      prefs.timeOfDay = tod;
      opts.onPrefsChange();
    }
  }

  function clockLoop(): void {
    clockRaf = 0;
    if (destroyed || !prefs.animateDay || !preview) return;
    const now = performance.now();
    if (now - lastClock > 200 && !document.hidden) {
      lastClock = now;
      tod = preview.getTimeOfDay();
      paintTime(tod);
    }
    clockRaf = requestAnimationFrame(clockLoop);
  }

  function setDayAnimation(on: boolean): void {
    prefs.animateDay = on;
    opts.onPrefsChange();
    playBtn.setActive(on);
    playBtn.setIcon(on ? 'pause' : 'play');
    playBtn.setAttribute('aria-label', on ? et.stage.pause : et.stage.play);
    tooltip(playBtn, on ? et.stage.pause : et.stage.play);
    if (!preview) return;
    if (on) {
      preview.setTimeAnimation(true);
      if (!clockRaf) clockRaf = requestAnimationFrame(clockLoop);
    } else {
      tod = preview.getTimeOfDay();
      preview.setTimeAnimation(false);
      setTime(tod);
    }
    paintTime(tod);
  }

  function toggleDayAnimation(): void {
    setDayAnimation(!prefs.animateDay);
  }

  function toggleAutoRotate(): void {
    prefs.autoRotate = !prefs.autoRotate;
    opts.onPrefsChange();
    rotateBtn.setActive(prefs.autoRotate);
    preview?.setAutoRotate(prefs.autoRotate);
  }

  function resetCamera(): void {
    preview?.resetCamera();
  }

  function setCompare(on: boolean): void {
    if (comparing === on) return;
    comparing = on;
    compareBtn.setAttribute('aria-pressed', String(on));
    compareBadge.hidden = !on;
    el.classList.toggle('is-comparing', on);
    update();
  }

  async function capture(): Promise<Blob | null> {
    // hidden (e.g. another tab on phones): the canvas has no useful size
    if (!preview || host.clientWidth < 16 || host.clientHeight < 16) return null;
    const was = comparing;
    if (was) {
      comparing = false;
      preview.setParams(currentParams());
    }
    try {
      return await preview.screenshot();
    } catch {
      return null;
    } finally {
      if (was) {
        comparing = true;
        update();
      }
    }
  }

  async function saveScreenshot(): Promise<void> {
    if (!preview) return;
    try {
      const blob = await preview.screenshot();
      opts.onScreenshot(blob, `${opts.screenshotName()} preview.png`);
    } catch (err) {
      toast(friendlyError(err, et.stage.screenshotFailed), { tone: 'error' });
    }
  }

  paintTime(tod);
  textures.start();

  return {
    el,
    async mount() {
      if (preview || destroyed) return;
      const { createShaderPreview } = await import('../../../shared/preview/shader-preview');
      if (destroyed) return;
      preview = createShaderPreview(host, { params: currentParams(), autoRotate: prefs.autoRotate && !reduced, assets: null, text: et.stage.preview });
      if (prefs.animateDay) setDayAnimation(true);
      resolvePreview(preview);
    },
    update,
    setTexturesSource(e, v) {
      textures.setBase(e, v);
    },
    openTexturesMenu: () => textures.openMenu(),
    setTime: (t) => setTime(t),
    setDayAnimation,
    toggleDayAnimation,
    toggleAutoRotate,
    setCompare,
    resetCamera,
    capture,
    saveScreenshot,
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      if (clockRaf) cancelAnimationFrame(clockRaf);
      textures.destroy();
      resolvePreview(null);
      preview?.destroy();
      preview = null;
    },
  };
}
