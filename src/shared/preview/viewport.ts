// Small helpers shared by the 3D previews: a visibility-aware render loop and an orbit camera controller.

let reducedMotionQuery: MediaQueryList | null | undefined;
/** True when the user asked the system to minimise motion (cached media query, cheap to call per frame). */
export function prefersReducedMotion(): boolean {
  if (reducedMotionQuery === undefined) {
    reducedMotionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  }
  return reducedMotionQuery?.matches ?? false;
}

/**
 * Calls `onChange` whenever window.devicePixelRatio changes (browser zoom, moving the window to another
 * monitor). Returns a function that stops watching.
 */
export function watchDevicePixelRatio(onChange: () => void): () => void {
  if (typeof matchMedia !== 'function' || typeof window === 'undefined') return () => {};
  let query: MediaQueryList | null = null;
  let stopped = false;
  const arm = (): void => {
    query?.removeEventListener('change', fire);
    query = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    query.addEventListener('change', fire);
  };
  const fire = (): void => {
    if (stopped) return;
    arm();
    onChange();
  };
  arm();
  return () => {
    stopped = true;
    query?.removeEventListener('change', fire);
    query = null;
  };
}

export interface LoopOptions {
  /** Called every animation frame while visible. Return false when nothing is animating (loop idles until invalidated). */
  frame: (dt: number, now: number) => boolean | void;
  /** Called with the CSS size of the container whenever it changes (and once at start). */
  resize: (width: number, height: number) => void;
  /** Called once when `frame` keeps throwing; the loop then stops until invalidated. */
  error?: (err: unknown) => void;
}

/**
 * Runs `frame` on requestAnimationFrame only while the element is on screen and the page is visible.
 * Uses ResizeObserver / IntersectionObserver / visibilitychange.
 */
export class ViewportLoop {
  private raf = 0;
  private last = 0;
  private onScreen = true;
  private idle = false;
  private disposed = false;
  private ro: ResizeObserver | null = null;
  private io: IntersectionObserver | null = null;
  private width = 0;
  private height = 0;
  private failures = 0;
  private readonly unwatchDpr: () => void;

  constructor(private readonly el: HTMLElement, private readonly opts: LoopOptions) {
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.measure());
      this.ro.observe(el);
    } else {
      window.addEventListener('resize', this.onWindowResize);
    }
    this.unwatchDpr = watchDevicePixelRatio(() => this.measure(true));
    if (typeof IntersectionObserver !== 'undefined') {
      this.io = new IntersectionObserver((entries) => {
        const e = entries[entries.length - 1];
        this.onScreen = e ? e.isIntersecting : true;
        this.update();
      });
      this.io.observe(el);
    }
    document.addEventListener('visibilitychange', this.update);
    this.measure();
    this.update();
  }

  get size(): [number, number] {
    return [this.width, this.height];
  }

  get running(): boolean {
    return this.raf !== 0;
  }

  private onWindowResize = (): void => this.measure();

  /** Layout size (ignores CSS transforms such as a scale-in animation, which ResizeObserver does not report). */
  private measure(force = false): void {
    if (this.disposed) return;
    const w = Math.max(1, this.el.clientWidth);
    const h = Math.max(1, this.el.clientHeight);
    if (!force && w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.opts.resize(w, h);
    this.invalidate();
  }

  private visible(): boolean {
    return !this.disposed && this.onScreen && document.visibilityState !== 'hidden';
  }

  private update = (): void => {
    if (this.visible() && !this.idle) this.start();
    else this.stop();
  };

  private start(): void {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private tick = (now: number): void => {
    this.raf = 0;
    if (!this.visible()) return;
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    let more: boolean | void = true;
    try {
      more = this.opts.frame(dt, now);
      this.failures = 0;
    } catch (err) {
      console.error(err);
      // a frame that keeps throwing would otherwise spam the console 60 times a second
      if (++this.failures >= 3) {
        more = false;
        this.failures = 0;
        this.opts.error?.(err);
      }
    }
    this.idle = more === false;
    if (!this.idle) this.raf = requestAnimationFrame(this.tick);
  };

  /** Wakes an idle loop to render at least one more frame. */
  invalidate(): void {
    this.idle = false;
    this.update();
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
    this.ro?.disconnect();
    this.io?.disconnect();
    this.unwatchDpr();
    window.removeEventListener('resize', this.onWindowResize);
    document.removeEventListener('visibilitychange', this.update);
  }
}

export interface OrbitOptions {
  azimuth: number;
  elevation: number;
  distance: number;
  minDistance: number;
  maxDistance: number;
  minElevation: number;
  maxElevation: number;
  autoRotate?: boolean;
  /** rad/s */
  autoRotateSpeed?: number;
  onChange?: () => void;
}

/**
 * Minimal orbit controller: pointer drag rotates, wheel / pinch zooms, arrow keys and +/- work when focused,
 * double-click or Home resets. Has inertia and optional auto-rotation that resumes after interaction.
 */
export class OrbitController {
  azimuth: number;
  elevation: number;
  distance: number;
  autoRotate: boolean;
  autoRotateSpeed: number;
  private vAz = 0;
  private vEl = 0;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private lastInteraction = -Infinity;
  private dragging = false;
  private moved = false;
  private lastMove = 0;

  constructor(private readonly el: HTMLElement, private readonly opts: OrbitOptions) {
    this.azimuth = opts.azimuth;
    this.elevation = opts.elevation;
    this.distance = opts.distance;
    this.autoRotate = opts.autoRotate ?? false;
    this.autoRotateSpeed = opts.autoRotateSpeed ?? 0.12;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    el.addEventListener('lostpointercapture', this.onUp);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('keydown', this.onKey);
    el.addEventListener('dblclick', this.onDbl);
  }

  get interacting(): boolean {
    return this.dragging;
  }

  private touch(): void {
    this.lastInteraction = performance.now();
    this.opts.onChange?.();
  }

  private clamp(): void {
    this.elevation = Math.min(this.opts.maxElevation, Math.max(this.opts.minElevation, this.elevation));
    this.distance = Math.min(this.opts.maxDistance, Math.max(this.opts.minDistance, this.distance));
  }

  private onDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      // capture is best effort
    }
    this.dragging = true;
    this.moved = false;
    this.vAz = 0;
    this.vEl = 0;
    this.lastMove = performance.now();
    if (this.pointers.size === 2) this.pinchDist = this.pinchDistance();
    this.touch();
  };

  private pinchDistance(): number {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private onMove = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.pointers.size >= 2) {
      const d = this.pinchDistance();
      if (this.pinchDist > 0 && d > 0) this.distance *= this.pinchDist / d;
      this.pinchDist = d;
      this.clamp();
      this.touch();
      return;
    }
    if (Math.abs(dx) + Math.abs(dy) > 0) this.moved = true;
    const h = Math.max(200, this.el.clientHeight);
    const k = (Math.PI * 1.6) / h;
    this.azimuth -= dx * k;
    this.elevation += dy * k;
    const now = performance.now();
    const dt = Math.max(8, now - this.lastMove) / 1000;
    this.lastMove = now;
    this.vAz = this.vAz * 0.5 + ((-dx * k) / dt) * 0.5;
    this.vEl = this.vEl * 0.5 + ((dy * k) / dt) * 0.5;
    this.clamp();
    this.touch();
  };

  private onUp = (e: PointerEvent): void => {
    if (!this.pointers.delete(e.pointerId)) return;
    if (this.pointers.size < 2) this.pinchDist = 0;
    if (this.pointers.size === 0) {
      this.dragging = false;
      if (!this.moved || prefersReducedMotion() || performance.now() - this.lastMove > 90) {
        this.vAz = 0;
        this.vEl = 0;
      }
    }
    this.touch();
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
    this.distance *= Math.exp(Math.max(-200, Math.min(200, e.deltaY * unit)) * 0.0012);
    this.clamp();
    this.touch();
  };

  private onKey = (e: KeyboardEvent): void => {
    const step = e.shiftKey ? 0.3 : 0.12;
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft': this.azimuth += step; break;
      case 'ArrowRight': this.azimuth -= step; break;
      case 'ArrowUp': this.elevation += step * 0.6; break;
      case 'ArrowDown': this.elevation -= step * 0.6; break;
      case '+': case '=': this.distance *= 0.9; break;
      case '-': case '_': this.distance *= 1.1; break;
      case 'Home': case '0': this.reset(); break;
      default: handled = false;
    }
    if (handled) {
      e.preventDefault();
      this.clamp();
      this.touch();
    }
  };

  private onDbl = (): void => {
    this.reset();
  };

  /** Changes the view that reset() (double-click / Home) returns to, and goes there. */
  setHome(view: { azimuth: number; elevation: number; distance: number }, jump = true): void {
    (this.opts as { azimuth: number }).azimuth = view.azimuth;
    (this.opts as { elevation: number }).elevation = view.elevation;
    (this.opts as { distance: number }).distance = view.distance;
    if (jump) this.reset();
  }

  reset(): void {
    this.azimuth = this.opts.azimuth;
    this.elevation = this.opts.elevation;
    this.distance = this.opts.distance;
    this.vAz = 0;
    this.vEl = 0;
    this.touch();
  }

  /** Advances inertia / auto-rotation. Returns true when the view changed. */
  update(dt: number): boolean {
    let changed = false;
    if (!this.dragging && (Math.abs(this.vAz) > 1e-4 || Math.abs(this.vEl) > 1e-4)) {
      this.vAz = Math.max(-6, Math.min(6, this.vAz));
      this.vEl = Math.max(-4, Math.min(4, this.vEl));
      this.azimuth += this.vAz * dt;
      this.elevation += this.vEl * dt;
      const decay = Math.exp(-dt * 5);
      this.vAz *= decay;
      this.vEl *= decay;
      if (Math.abs(this.vAz) < 1e-3) this.vAz = 0;
      if (Math.abs(this.vEl) < 1e-3) this.vEl = 0;
      this.clamp();
      changed = true;
    }
    if (this.autoRotate && !this.dragging && performance.now() - this.lastInteraction > 2500 && !prefersReducedMotion()) {
      this.azimuth += this.autoRotateSpeed * dt;
      changed = true;
    }
    return changed;
  }

  /** True while inertia or auto-rotation will keep moving the view. */
  get animating(): boolean {
    return this.dragging || this.vAz !== 0 || this.vEl !== 0 || (this.autoRotate && !prefersReducedMotion());
  }

  /** Camera position relative to the target. */
  offset(): [number, number, number] {
    const ce = Math.cos(this.elevation);
    return [Math.sin(this.azimuth) * ce * this.distance, Math.sin(this.elevation) * this.distance, Math.cos(this.azimuth) * ce * this.distance];
  }

  dispose(): void {
    const el = this.el;
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('pointercancel', this.onUp);
    el.removeEventListener('lostpointercapture', this.onUp);
    el.removeEventListener('wheel', this.onWheel);
    el.removeEventListener('keydown', this.onKey);
    el.removeEventListener('dblclick', this.onDbl);
  }
}

function ensureStageStyles(): void {
  if (document.getElementById('preview-stage-styles')) return;
  const style = document.createElement('style');
  style.id = 'preview-stage-styles';
  style.textContent =
    '.preview-stage>canvas:focus-visible{outline:2px solid var(--tool-accent,#4fb3ff);outline-offset:-2px;border-radius:inherit}' +
    '.preview-stage>canvas{-webkit-tap-highlight-color:transparent}';
  document.head.appendChild(style);
}

/** Creates the wrapper used by all previews: a positioned box holding the canvas plus an optional message overlay. */
export function createStage(container: HTMLElement, label: string): { root: HTMLDivElement; canvas: HTMLCanvasElement; message(text: string | null): void } {
  ensureStageStyles();
  const root = document.createElement('div');
  root.className = 'preview-stage';
  root.style.cssText = 'position:relative;width:100%;height:100%;min-height:120px;overflow:hidden;';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'display:block;width:100%;height:100%;cursor:grab;';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', label);
  canvas.addEventListener('pointerdown', () => (canvas.style.cursor = 'grabbing'));
  const release = () => (canvas.style.cursor = 'grab');
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  root.appendChild(canvas);
  let msg: HTMLDivElement | null = null;
  container.appendChild(root);
  return {
    root,
    canvas,
    message(text) {
      if (!text) {
        msg?.remove();
        msg = null;
        return;
      }
      if (!msg) {
        msg = document.createElement('div');
        msg.setAttribute('role', 'status');
        msg.style.cssText =
          'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;text-align:center;' +
          'font:inherit;color:var(--text-2,#b4bccb);background:var(--surface,#181c25);';
        root.appendChild(msg);
      }
      msg.textContent = text;
    },
  };
}
