// Pixel sparkles orbiting the hero grass block. They are stirred by the block's spin:
// spinning it drags them around in the same direction, flings them outward, makes them rise
// faster and throws off short-lived sparks with motion trails.

const COLORS = ['#7ddc5a', '#7ddc5a', '#ffffff', 'gold'] as const;
const BASE_COUNT = 34;
const MAX_SPARKS = 90;
/** Camera looks down on the block (~24deg), so an orbit circle projects to a flat ellipse. */
const TILT = 0.3;

interface Mote {
  theta: number; // angle around the vertical axis (radians)
  radius: number; // current orbit radius, in units of the block size
  base: number; // resting orbit radius
  y: number; // height, -1 (bottom) .. 1 (top), in units of the block size
  rise: number; // upward speed (block sizes per second)
  size: number; // CSS px
  color: number;
  life: number; // seconds left; Infinity for orbiting motes
  maxLife: number;
  flung: number; // outward speed for sparks
  px: number; // previous screen position (for trails)
  py: number;
}

export interface HeroParticles {
  canvas: HTMLCanvasElement;
  /** dt in seconds; spin = block yaw speed in degrees per second (signed). */
  update(dt: number, spin: number): void;
  destroy(): void;
}

export function createHeroParticles(seed = 99): HeroParticles {
  const canvas = document.createElement('canvas');
  canvas.className = 'hb-particles';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d')!;

  let s = seed >>> 0 || 1;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);

  let w = 0;
  let h = 0;
  let dpr = 1;
  let unit = 100; // block size in CSS px
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = Math.max(1, Math.round(r.width));
    h = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    unit = Math.min(w / 2, h / 1.9);
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  ro?.observe(canvas);

  // soft glow sprites, one per colour (the crisp pixel square is drawn on top)
  const glowCache = new Map<string, HTMLCanvasElement>();
  const glow = (color: string) => {
    let g = glowCache.get(color);
    if (!g) {
      g = document.createElement('canvas');
      g.width = g.height = 32;
      const gc = g.getContext('2d')!;
      const grad = gc.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'transparent');
      gc.globalAlpha = 0.9;
      gc.fillStyle = grad;
      gc.fillRect(0, 0, 32, 32);
      glowCache.set(color, g);
    }
    return g;
  };
  const colorOf = (i: number) => {
    const c = COLORS[i];
    if (c !== 'gold') return c;
    return getComputedStyle(canvas).getPropertyValue('--gold').trim() || '#ffcf4a';
  };
  let palette = COLORS.map((_, i) => colorOf(i));
  const refreshPalette = () => (palette = COLORS.map((_, i) => colorOf(i)));

  const spawnMote = (anywhere: boolean): Mote => {
    const base = 0.72 + rnd() * 0.5;
    return {
      theta: rnd() * Math.PI * 2,
      radius: base,
      base,
      y: anywhere ? -1 + rnd() * 2 : -0.9 - rnd() * 0.2,
      rise: 0.12 + rnd() * 0.12,
      size: rnd() < 0.35 ? 8 : 6,
      color: Math.floor(rnd() * COLORS.length),
      life: Infinity,
      maxLife: Infinity,
      flung: 0,
      px: NaN,
      py: NaN,
    };
  };
  const motes: Mote[] = Array.from({ length: BASE_COUNT }, () => spawnMote(true));
  const sparks: Mote[] = [];
  let sparkDebt = 0;
  let swirl = 1; // last spin direction, so idle drift keeps the same sense

  const project = (m: Mote) => {
    const depth = Math.cos(m.theta); // 1 = in front of the block, -1 = behind it
    const x = w / 2 + Math.sin(m.theta) * m.radius * unit;
    const y = h * 0.47 - m.y * unit * 0.95 + depth * m.radius * unit * TILT;
    return { x, y, depth };
  };

  const update = (dt: number, spin: number) => {
    if (!w) resize();
    const spinRad = (spin * Math.PI) / 180;
    const speed = Math.abs(spinRad);
    if (speed > 0.2) swirl = Math.sign(spinRad);
    const energy = Math.min(1, speed / 6); // 0 idle .. 1 hard flick
    const spread = 1 + energy * 0.8;

    for (const m of motes) {
      // inner motes are dragged harder, like air near the spinning block
      const drag = spinRad * 0.85 * (0.8 / m.radius);
      m.theta += (swirl * 0.35 + drag) * dt;
      m.radius += (m.base * spread - m.radius) * Math.min(1, dt * (energy > m.radius - m.base ? 6 : 1.5));
      m.y += (m.rise * (1 + energy * 5)) * dt;
      if (m.y > 1.05) Object.assign(m, spawnMote(false));
    }

    // fast spins throw off sparks from the block's edges
    sparkDebt += Math.max(0, speed - 1.5) * 12 * dt;
    while (sparkDebt >= 1 && sparks.length < MAX_SPARKS) {
      sparkDebt -= 1;
      const sp = spawnMote(true);
      sp.radius = 0.55 + rnd() * 0.15;
      sp.y = -0.6 + rnd() * 1.2;
      sp.flung = 0.8 + rnd() * 1.2 + energy * 1.5;
      sp.life = sp.maxLife = 0.6 + rnd() * 0.8;
      sp.rise = 0.05 + rnd() * 0.2;
      sp.size = rnd() < 0.5 ? 6 : 4;
      sp.color = rnd() < 0.5 ? 3 : 2;
      sparks.push(sp);
    }
    if (sparkDebt > 1) sparkDebt = 1;
    for (let i = sparks.length - 1; i >= 0; i--) {
      const sp = sparks[i];
      sp.life -= dt;
      if (sp.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }
      sp.theta += spinRad * 0.6 * dt;
      sp.radius += sp.flung * dt;
      sp.y += sp.rise * dt;
    }
    draw(energy);
  };

  const draw = (energy: number) => {
    const light = document.documentElement.dataset.theme === 'light';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const all = motes.concat(sparks).map((m) => ({ m, ...project(m) }));
    all.sort((a, b) => a.depth - b.depth);
    for (const { m, x, y, depth } of all) {
      const front = (depth + 1) / 2; // 0 behind .. 1 in front
      const edge = Math.min(1, (m.y + 1.05) * 3, (1.05 - m.y) * 2.5); // fade in/out at bottom/top
      const lifeFade = Number.isFinite(m.maxLife) ? m.life / m.maxLife : 1;
      const alpha = Math.max(0, edge) * lifeFade * (0.5 + 0.5 * front) * (light ? 0.85 : 1);
      if (alpha <= 0.01) {
        m.px = NaN;
        continue;
      }
      const color = palette[m.color];
      const size = Math.max(3, Math.round(m.size * (0.7 + 0.4 * front) * (1 + energy * 0.35)));
      // motion trail when moving fast on screen
      if (Number.isFinite(m.px)) {
        const dx = x - m.px;
        const dy = y - m.py;
        const dist = Math.hypot(dx, dy);
        if (dist > 2) {
          ctx.globalAlpha = alpha * Math.min(0.75, dist / 25);
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(1, size / 2);
          ctx.beginPath();
          ctx.moveTo(m.px, m.py);
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      }
      m.px = x;
      m.py = y;
      if (!light) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = alpha * (0.7 + energy * 0.3);
        const g = size * (4 + energy * 2);
        ctx.drawImage(glow(color), x - g / 2, y - g / 2, g, g);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
    }
    ctx.globalAlpha = 1;
  };

  const themeObserver = new MutationObserver(refreshPalette);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  return {
    canvas,
    update,
    destroy() {
      ro?.disconnect();
      themeObserver.disconnect();
    },
  };
}
