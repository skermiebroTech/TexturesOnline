// Right panel "Preview" tab in GUI mode: the pack's interface drawn as the game shows it, live while
// you paint: the HUD over a little world, the inventory and containers, the title screen with its
// turning panorama, splash and buttons, a menu, and enchanted items. It follows the texture open in
// the pixel editor (hearts open → the HUD with those hearts), scales by whole GUI pixels like the
// game, names the part under the pointer and opens it when clicked. "Show bigger" opens the same
// preview in a dialog.

import { h } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import { button, select, toggle } from '../../../ui/components';
import { openModal } from '../../../ui/modal';
import { fmt } from '../../../i18n/editor-text';
import { byPointer } from '../ui/media';
import { versionLabel } from '../ui/start-screen';
import { CONTAINERS, type ContainerId, type GuiCatalog, type GuiPart, type GuiPiece, type GuiScreen } from './catalog';
import { panoramaHit, panoramaYaw } from './panorama';
import { HUD_LOOKS, guiScale, renderGui, type HudLook, type Hit, type RenderState, type ScreenLabels } from './render';
import type { GuiSources } from './sources';
import { pieceTitle } from './library';
import { tg } from './i18n/text';

export interface GuiPreview {
  el: HTMLElement;
  setVisible(v: boolean): void;
  /** The texture open in the pixel editor (null: none); `piece`: the piece picked in the library */
  follow(path: string | null, piece?: GuiPiece | null): void;
  /** Shows the title screen with this splash */
  showSplash(text: string | null, open?: boolean): void;
  screen(): GuiScreen;
  setScreen(s: GuiScreen): void;
  /** Hit areas of the last drawing (tests) */
  hits(): Hit[];
  /** The preview's size in GUI pixels and its GUI scale in device pixels (tests) */
  size(): { w: number; h: number; r: number };
  destroy(): void;
}

export interface GuiPreviewOptions {
  sources: GuiSources;
  cat: GuiCatalog;
  /** A part of the preview was clicked: open its texture (`piece` when it is a GUI piece) */
  open(path: string, piece: GuiPiece | null): void;
}

const SCREEN_ICONS = { hud: 'heart', inventory: 'package', title: 'monitor', menu: 'menu', glint: 'sparkles' } as const;

/** The HUD look that shows a part. */
const LOOK_OF: Partial<Record<GuiPart['id'], HudLook>> = {
  hearts: 'normal',
  heartsPoisoned: 'poisoned',
  heartsWithered: 'withered',
  heartsFrozen: 'frozen',
  heartsAbsorbing: 'absorbing',
  heartsHardcore: 'hardcore',
  heartsMount: 'riding',
  food: 'normal',
  foodHunger: 'hunger',
  air: 'underwater',
};

interface Shared {
  screen: GuiScreen;
  container: ContainerId;
  look: HudLook;
  flash: boolean;
  inGame: boolean;
  focus: string | null;
  splash: string | null;
}

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createGuiPreview(opts: GuiPreviewOptions): GuiPreview {
  const { sources, cat } = opts;
  const st: Shared = { screen: 'hud', container: 'inventory', look: 'normal', flash: false, inGame: false, focus: null, splash: null };
  const stages = new Set<Stage>();
  let visible = false;

  const labels = (): ScreenLabels => {
    const g = tg.game;
    const m = g.menu;
    return { ...g, menuButtons: [m.graphics, m.distance, m.smooth, m.fullscreen, m.guiScale, m.brightness, m.clouds, m.particles, m.bobbing, m.fps] };
  };
  const versionText = () => (cat.edition === 'java' ? `Minecraft ${cat.version}` : versionLabel(sources.store.project));

  // ---------------------------------------------------------------- controls
  const screenBar = h('div', { class: 'gui-pv-screens', role: 'radiogroup', 'aria-label': tg.preview.screen });
  const screenBtns = new Map<GuiScreen, HTMLButtonElement>();
  for (const s of cat.screens) {
    const b = h('button', { type: 'button', class: 'gui-pv-screen', role: 'radio', dataset: { screen: s }, 'aria-checked': 'false' }, icon(SCREEN_ICONS[s], { size: 16 }), h('span', null, tg.preview.screens[s]));
    b.addEventListener('click', () => setScreen(s));
    screenBtns.set(s, b);
    screenBar.appendChild(b);
  }
  screenBar.addEventListener('keydown', (e) => {
    const list = [...screenBtns.values()];
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = list[(i + d + list.length) % list.length];
    n.focus();
    n.click();
  });

  const lookSel = select<HudLook>({
    label: tg.preview.look,
    value: st.look,
    options: HUD_LOOKS.filter((l) => l !== 'frozen' || cat.part('heartsFrozen')).map((l) => ({ value: l, label: tg.preview.looks[l] })),
    onChange: (v) => {
      st.look = v;
      st.flash = false;
      redraw();
    },
  });
  const containerOptions = (cat.edition === 'java' ? CONTAINERS : (['inventory'] as ContainerId[])).filter((c) => cat.edition === 'bedrock' || cat.part(c === 'largeChest' ? 'chest' : c));
  const containerSel = select<ContainerId>({
    label: tg.preview.container,
    value: st.container,
    options: containerOptions.map((c) => ({ value: c, label: tg.preview.containers[c] })),
    onChange: (v) => {
      st.container = v;
      redraw();
    },
  });
  const inGameToggle = toggle({
    label: tg.preview.inGame,
    value: st.inGame,
    onChange: (v) => {
      st.inGame = v;
      redraw();
    },
  });
  const fxToggle = toggle({
    label: tg.preview.effects,
    value: true,
    onChange: (v) => {
      sources.effects = v;
      sources.reload();
    },
  });
  lookSel.classList.add('gui-pv-look');
  containerSel.classList.add('gui-pv-window');
  inGameToggle.classList.add('gui-pv-ingame');
  const optsRow = h('div', { class: 'gui-pv-opts' }, lookSel, containerSel, inGameToggle);
  const stageSlot = h('div');
  const tip = byPointer(tg.preview.hint, tg.preview.hintTouch);
  const biggerBtn = button({ label: tg.preview.bigger, icon: 'expand', size: 'sm', variant: 'secondary', class: 'gui-pv-bigger', onClick: () => openBigger() });
  const scaleEl = h('span', { class: 'gui-pv-scale faint' });
  const note = h('p', { class: 'tx-inline-note gui-pv-note', hidden: true });
  const el = h(
    'div',
    { class: 'gui-pv', 'aria-label': tg.preview.label },
    screenBar,
    optsRow,
    stageSlot,
    h('div', { class: 'gui-pv-foot' }, h('p', { class: 'gui-pv-hint muted' }, icon('pointer', { size: 16 }), h('span', null, tip)), scaleEl, biggerBtn),
    note,
    h('div', { class: 'gui-pv-fx' }, fxToggle),
  );

  function paintControls() {
    for (const [s, b] of screenBtns) {
      b.setAttribute('aria-checked', String(s === st.screen));
      b.tabIndex = s === st.screen ? 0 : -1;
    }
    lookSel.hidden = st.screen !== 'hud';
    lookSel.setValue(st.look);
    containerSel.hidden = st.screen !== 'inventory' || containerOptions.length < 2;
    containerSel.setValue(st.container);
    inGameToggle.hidden = st.screen !== 'menu';
    inGameToggle.setValue(st.inGame);
    optsRow.hidden = lookSel.hidden && containerSel.hidden && inGameToggle.hidden;
    (el.querySelector('.gui-pv-fx') as HTMLElement).hidden = !sources.store.effectsActive();
    const msgs: string[] = [];
    if ((st.screen === 'title' || (st.screen === 'menu' && !st.inGame)) && sources.panoramaMissing()) msgs.push(tg.preview.panoramaMissing);
    if (reducedMotion()) msgs.push(tg.preview.paused);
    note.hidden = !msgs.length;
    note.replaceChildren(icon('circle-info', { size: 16 }), h('span', null, msgs.join(' ')));
  }

  function setScreen(s: GuiScreen) {
    if (!cat.screens.includes(s)) return;
    st.screen = s;
    paintControls();
    redraw();
  }

  function redraw() {
    for (const s of stages) s.draw();
  }

  // ---------------------------------------------------------------- a drawing surface
  class Stage {
    readonly box: HTMLElement;
    readonly canvas: HTMLCanvasElement;
    readonly tag: HTMLElement;
    W = 320;
    H = 240;
    R = 1;
    hits: Hit[] = [];
    pointer: { x: number; y: number } | null = null;
    hover: Hit | null = null;
    private ro: ResizeObserver;

    constructor(readonly big: boolean) {
      this.canvas = h('canvas', { class: 'gui-pv-canvas' });
      this.tag = h('span', { class: 'gui-pv-tag', hidden: true });
      this.box = h('div', { class: ['gui-pv-stage', big && 'is-big'] }, this.canvas, this.tag);
      this.ro = new ResizeObserver(() => this.layout());
      this.ro.observe(this.box);
      this.canvas.addEventListener('pointermove', (e) => this.move(e));
      this.canvas.addEventListener('pointerleave', () => {
        this.pointer = null;
        this.hover = null;
        this.tag.hidden = true;
        this.draw();
      });
      this.canvas.addEventListener('click', (e) => this.click(e));
      stages.add(this);
    }

    layout() {
      const dpr = window.devicePixelRatio || 1;
      const r = this.box.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const dw = Math.floor(r.width * dpr);
      const dh = Math.floor(r.height * dpr);
      this.R = guiScale(dw, dh);
      this.W = Math.floor(dw / this.R);
      this.H = Math.floor(dh / this.R);
      this.canvas.width = this.W * this.R;
      this.canvas.height = this.H * this.R;
      this.canvas.style.width = `${(this.W * this.R) / dpr}px`;
      this.canvas.style.height = `${(this.H * this.R) / dpr}px`;
      if (!this.big) scaleEl.textContent = fmt(tg.preview.scale, { scale: this.R });
      this.draw();
    }

    toGui(e: PointerEvent | MouseEvent) {
      const r = this.canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * this.W, y: ((e.clientY - r.top) / r.height) * this.H };
    }

    hitAt(p: { x: number; y: number }): Hit | null {
      for (let i = this.hits.length - 1; i >= 0; i--) {
        const hh = this.hits[i];
        if (p.x >= hh.x && p.x < hh.x + hh.w && p.y >= hh.y && p.y < hh.y + hh.h) return hh;
      }
      // the panorama behind the title screen and menus
      if (st.screen === 'title' || (st.screen === 'menu' && !st.inGame && !cat.atlases && !!cat.piece('backgrounds.menu'))) {
        const f = panoramaHit(p.x / this.W, p.y / this.H, this.W / this.H, { yaw: panoramaYaw(now()), pitch: -10, fov: 85 });
        const key = (['front', 'right', 'back', 'left', 'top', 'bottom'] as const)[f.face];
        const piece = cat.piece(`panorama.${key}`);
        if (piece) return { x: 0, y: 0, w: this.W, h: this.H, path: piece.path, piece };
      }
      return null;
    }

    move(e: PointerEvent) {
      if (e.pointerType === 'touch') return;
      this.pointer = this.toGui(e);
      const hit = this.hitAt(this.pointer);
      this.hover = hit && hit.w < this.W ? hit : null;
      this.canvas.style.cursor = hit ? 'pointer' : '';
      if (hit) {
        const name = hit.piece ? pieceTitle(hit.piece) : prettyName(hit.name ?? hit.path);
        this.tag.textContent = fmt(tg.preview.hitTip, { name, file: hit.path.replace(/^assets\/minecraft\/textures\/|^textures\//, '') });
        const br = this.box.getBoundingClientRect();
        this.tag.hidden = false;
        const x = e.clientX - br.left;
        const y = e.clientY - br.top;
        this.tag.style.left = `${Math.min(Math.max(4, x + 12), br.width - this.tag.offsetWidth - 4)}px`;
        this.tag.style.top = `${y + 18 + this.tag.offsetHeight > br.height ? y - this.tag.offsetHeight - 8 : y + 18}px`;
      } else this.tag.hidden = true;
      this.draw();
    }

    click(e: MouseEvent) {
      const hit = this.hitAt(this.toGui(e));
      if (!hit) return;
      opts.open(hit.path, hit.piece ?? null);
    }

    draw() {
      if (!visible && !this.big) return;
      const ctx = this.canvas.getContext('2d');
      if (!ctx || !this.canvas.width) return;
      const state: RenderState = {
        screen: st.screen,
        container: st.container,
        look: st.look,
        flash: st.flash,
        time: now(),
        pointer: this.pointer,
        focus: st.focus,
        splash: st.splash,
        inGame: st.inGame,
        labels: labels(),
        versionText: versionText(),
      };
      this.hits = renderGui(ctx, this.W, this.H, this.R, cat, sources, state);
      const hv = this.hover;
      if (hv) {
        const R = this.R;
        ctx.save();
        ctx.lineWidth = Math.max(1, R);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.strokeRect(hv.x * R - ctx.lineWidth * 1.5, hv.y * R - ctx.lineWidth * 1.5, hv.w * R + ctx.lineWidth * 3, hv.h * R + ctx.lineWidth * 3);
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(hv.x * R - ctx.lineWidth / 2, hv.y * R - ctx.lineWidth / 2, hv.w * R + ctx.lineWidth, hv.h * R + ctx.lineWidth);
        ctx.restore();
      }
    }

    destroy() {
      this.ro.disconnect();
      stages.delete(this);
    }
  }

  const main = new Stage(false);
  stageSlot.replaceWith(main.box);

  // ---------------------------------------------------------------- animation
  const start = performance.now();
  const now = () => (reducedMotion() ? 0 : performance.now() - start);
  let raf = 0;
  let last = 0;
  const animated = () => !reducedMotion() && (st.screen !== 'menu' || !st.inGame);
  function loop(t: number) {
    raf = 0;
    if (!visible && ![...stages].some((s) => s.big)) return;
    if (t - last > 33) {
      last = t;
      redraw();
    }
    if (animated()) raf = requestAnimationFrame(loop);
  }
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(loop);
  };
  sources.onChange = () => {
    paintControls();
    redraw();
    kick();
  };

  // ---------------------------------------------------------------- bigger
  function openBigger() {
    const big = new Stage(true);
    const bar = screenBar.cloneNode(false) as HTMLElement;
    const rebuildBar = () => {
      bar.replaceChildren(
        ...cat.screens.map((s) => {
          const b = h('button', { type: 'button', class: 'gui-pv-screen', role: 'radio', dataset: { screen: s }, 'aria-checked': String(s === st.screen) }, icon(SCREEN_ICONS[s], { size: 16 }), h('span', null, tg.preview.screens[s]));
          b.addEventListener('click', () => {
            setScreen(s);
            rebuildBar();
          });
          return b;
        }),
      );
    };
    rebuildBar();
    const m = openModal({
      title: tg.preview.biggerTitle,
      class: 'gui-pv-modal',
      width: 1180,
      body: h('div', { class: 'gui-pv-big' }, bar, big.box),
      onClose: () => {
        big.destroy();
      },
    });
    void m;
    requestAnimationFrame(() => {
      big.layout();
      kick();
    });
  }

  paintControls();

  return {
    el,
    setVisible(v) {
      visible = v;
      if (v) {
        main.layout();
        paintControls();
        kick();
      }
    },
    follow(path, piece) {
      const pieces = path ? cat.piecesOf(path) : [];
      const p = piece && pieces.includes(piece) ? piece : (pieces.find((x) => x.id === st.focus) ?? pieces[0] ?? null);
      st.focus = p?.id ?? null;
      if (p) {
        const part = cat.part(p.part)!;
        st.screen = part.screen;
        if (part.container) st.container = part.container === 'chest' && st.container === 'largeChest' ? 'largeChest' : part.container;
        const look = LOOK_OF[part.id];
        if (look) st.look = look;
        st.flash = /Flash$/.test(p.key);
        if (part.id === 'backgrounds') st.inGame = /^inworld/.test(p.key);
      }
      paintControls();
      redraw();
      kick();
    },
    showSplash(text, open = true) {
      st.splash = text;
      if (open) st.screen = 'title';
      paintControls();
      redraw();
      kick();
    },
    screen: () => st.screen,
    setScreen,
    hits: () => main.hits,
    size: () => ({ w: main.W, h: main.H, r: main.R }),
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      for (const s of [...stages]) s.destroy();
    },
  };
}

function prettyName(path: string): string {
  const name = path.replace(/^.*\//, '').replace(/\.(png|tga)$/, '');
  return name.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}
