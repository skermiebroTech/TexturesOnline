// Center preview stage: live 3D preview, time of day, auto-rotate, compare, screenshot and the
// optional real game textures.

import type { AssetIndex, Edition, PreviewParams } from '../../../core/types';
import { isAssetsCached, loadAssets } from '../../../editions/index';
import type { ShaderPreview } from '../../../shared/preview/shader-preview';
import { iconButton, spinner, tooltip } from '../../../ui/components';
import { h, prefersReducedMotion } from '../../../ui/dom';
import { icon, type IconName } from '../../../ui/icons';
import { toast } from '../../../ui/toast';
import { friendlyError, isAbortError } from '../../../core/net';
import type { ShaderPrefs } from './project';

export const TIME_PRESETS: { id: string; label: string; icon: IconName; tick: number; key: string }[] = [
  { id: 'sunrise', label: 'Sunrise', icon: 'cloud-sun', tick: 400, key: '1' },
  { id: 'noon', label: 'Noon', icon: 'sun', tick: 6000, key: '2' },
  { id: 'sunset', label: 'Sunset', icon: 'cloud-moon', tick: 11700, key: '3' },
  { id: 'night', label: 'Night', icon: 'moon', tick: 18000, key: '4' },
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
  setTexturesSource(edition: Edition, version: string): void;
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
  version: string;
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
  let edition = opts.edition;
  let version = opts.version;
  let texturesOn = false;
  let texturesCtrl: AbortController | null = null;
  let assets: AssetIndex | null = null;

  // ---- view
  const host = h('div', { class: 'sh-stage-host' });
  const compareBadge = h('div', { class: 'sh-compare-badge', hidden: true, role: 'status' }, icon('eye-off'), h('span', null, opts.compareLabel));
  const hint = h('div', { class: 'sh-stage-chip sh-stage-hint' }, icon('info'), h('span', null, 'Live preview'));
  tooltip(hint, 'An approximate in-browser preview. Drag to look around, scroll or pinch to zoom. The game will look a little different.');
  hint.tabIndex = 0;

  const texLabel = h('span', null, 'Game textures');
  const texStatus = h('span', { class: 'sh-tex-status' });
  const texBtn = h(
    'button',
    { type: 'button', class: 'sh-stage-chip sh-tex-btn', 'aria-pressed': 'false' },
    icon('image'),
    texLabel,
    texStatus,
  );
  texBtn.addEventListener('click', () => void setTextures(!texturesOn, true));
  const texTip = () =>
    edition === 'java'
      ? `Show the real Minecraft ${version} textures in the preview. The first time, about 6 MB of game files are downloaded from Mojang and kept on this device.`
      : 'Show the real Bedrock textures in the preview. A few textures are loaded from Mojang’s official samples.';
  tooltip(texBtn, texTip());

  const rotateBtn = iconButton('reload', 'Auto-rotate (R)', () => toggleAutoRotate(), { active: prefs.autoRotate && !reduced });
  const resetBtn = iconButton('target', 'Reset view (Home)', () => resetCamera());
  const shotBtn = iconButton('camera', 'Save a screenshot (P)', () => void saveScreenshot());
  const viewTools = h('div', { class: 'sh-stage-tools' }, rotateBtn, resetBtn, shotBtn);

  const compareBtn = h('button', { type: 'button', class: 'sh-compare-btn', 'aria-pressed': 'false' }, icon('eye'), h('span', null, 'Hold to compare'));
  tooltip(compareBtn, `Hold to see ${opts.compareLabel.toLowerCase()} (or hold C)`);
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

  const view = h(
    'div',
    { class: 'sh-stage-view' },
    host,
    compareBadge,
    h('div', { class: 'sh-stage-overlay tl' }, hint),
    h('div', { class: 'sh-stage-overlay tr' }, viewTools),
    h('div', { class: 'sh-stage-overlay bl' }, texBtn),
    h('div', { class: 'sh-stage-overlay br' }, compareBtn),
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
    'aria-label': 'Time of day',
  });
  const clock = h('output', { class: 'sh-clock', 'aria-hidden': 'true' });
  range.addEventListener('input', () => setTime(Number(range.value), false));
  const playBtn = iconButton('play', 'Play the day cycle (D)', () => toggleDayAnimation(), { active: false });
  playBtn.classList.add('sh-play');
  const timebar = h(
    'div',
    { class: 'sh-timebar' },
    h('div', { class: 'sh-time-presets', role: 'group', 'aria-label': 'Time of day' }, timeButtons),
    h('div', { class: 'sh-time-slider' }, range, clock),
    playBtn,
  );

  const el = h('section', { class: 'panel sh-stage', 'aria-label': 'Live preview' }, view, timebar);

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
    playBtn.setAttribute('aria-label', on ? 'Pause the day cycle (D)' : 'Play the day cycle (D)');
    tooltip(playBtn, on ? 'Pause the day cycle (D)' : 'Play the day cycle (D)');
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
    if (!preview) return null;
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
      toast(friendlyError(err, "Couldn't take a screenshot"), { tone: 'error' });
    }
  }

  function paintTextures(state: 'off' | 'loading' | 'on', pct?: number): void {
    texBtn.setAttribute('aria-pressed', String(state !== 'off'));
    texBtn.classList.toggle('is-loading', state === 'loading');
    texStatus.replaceChildren();
    if (state === 'loading') {
      texStatus.append(spinner(16), h('span', null, pct !== undefined ? `${Math.round(pct * 100)}%` : ''));
    }
  }

  async function setTextures(on: boolean, user: boolean): Promise<void> {
    texturesCtrl?.abort();
    texturesCtrl = null;
    texturesOn = on;
    if (user) {
      prefs.realTextures[edition] = on;
      opts.onPrefsChange();
    }
    if (!on) {
      paintTextures('off');
      assets = null;
      await preview?.setAssets(null);
      return;
    }
    const ctrl = new AbortController();
    texturesCtrl = ctrl;
    paintTextures('loading');
    try {
      const idx = await loadAssets(edition, version, {
        signal: ctrl.signal,
        onProgress: (p) => {
          if (!ctrl.signal.aborted) paintTextures('loading', p.fraction ?? undefined);
        },
      });
      if (ctrl.signal.aborted || destroyed) return;
      assets = idx;
      await preview?.setAssets(idx);
      if (ctrl.signal.aborted || destroyed) return;
      paintTextures('on');
    } catch (err) {
      if (ctrl.signal.aborted || isAbortError(err) || destroyed) return;
      texturesOn = false;
      paintTextures('off');
      if (user) toast(friendlyError(err, "Couldn't load the game textures"), { tone: 'error' });
    } finally {
      if (texturesCtrl === ctrl) texturesCtrl = null;
    }
  }

  async function initTextures(): Promise<void> {
    const pref = prefs.realTextures[edition];
    if (pref === false) return paintTextures('off');
    if (pref === true || (await isAssetsCached(edition, version))) await setTextures(true, false);
  }

  paintTime(tod);
  paintTextures('off');

  return {
    el,
    async mount() {
      if (preview || destroyed) return;
      const { createShaderPreview } = await import('../../../shared/preview/shader-preview');
      if (destroyed) return;
      preview = createShaderPreview(host, { params: currentParams(), autoRotate: prefs.autoRotate && !reduced, assets: null });
      if (prefs.animateDay) setDayAnimation(true);
      void initTextures();
    },
    update,
    setTexturesSource(e, v) {
      if (e === edition && v === version) return;
      edition = e;
      version = v;
      tooltip(texBtn, texTip());
      if (texturesOn) void setTextures(true, false);
    },
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
      texturesCtrl?.abort();
      preview?.destroy();
      preview = null;
      void assets;
    },
  };
}
