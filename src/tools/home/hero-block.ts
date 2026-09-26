// Rotating CSS 3D grass block for the landing hero (drag to spin, pauses when hidden).

import { h, prefersReducedMotion } from '../../ui/dom';
import { heroBlockFaces, prng } from './art';

type FaceName = 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right';

const NORMALS: Record<FaceName, [number, number, number]> = {
  top: [0, 1, 0],
  bottom: [0, -1, 0],
  front: [0, 0, 1],
  back: [0, 0, -1],
  left: [-1, 0, 0],
  right: [1, 0, 0],
};

// light from the upper left, slightly in front of the viewer (CSS axes: y points down)
const LIGHT = (() => {
  const v = [-0.45, -0.8, 0.55];
  const l = Math.hypot(v[0], v[1], v[2]);
  return v.map((x) => x / l) as [number, number, number];
})();

export function heroBlock(): { el: HTMLElement; destroy(): void } {
  const faces = heroBlockFaces();
  const faceEls = new Map<FaceName, HTMLElement>();
  const shades = new Map<FaceName, HTMLElement>();
  const cube = h('div', { class: 'hb-cube' });
  (Object.keys(NORMALS) as FaceName[]).forEach((name) => {
    const src = name === 'top' ? faces.top : name === 'bottom' ? faces.bottom : faces.side;
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 16;
    c.getContext('2d')!.drawImage(src, 0, 0);
    const shade = h('span', { class: 'hb-shade' });
    const face = h('div', { class: `hb-face hb-${name}` }, c, shade);
    faceEls.set(name, face);
    shades.set(name, shade);
    cube.appendChild(face);
  });

  const r = prng(99);
  const particles = h(
    'div',
    { class: 'hb-particles', 'aria-hidden': 'true' },
    Array.from({ length: 14 }, (_, i) =>
      h('i', {
        style: {
          '--x': `${Math.round(r() * 100)}%`,
          '--d': `${(r() * 6).toFixed(2)}s`,
          '--t': `${(5 + r() * 4).toFixed(2)}s`,
          '--ps': `${i % 3 === 0 ? 8 : 6}px`,
          '--c': i % 4 === 0 ? 'var(--gold)' : i % 3 === 0 ? '#ffffff' : '#7ddc5a',
        },
      }),
    ),
  );

  const stage = h('div', { class: 'hb-stage' }, cube);
  const el = h(
    'div',
    { class: 'hero-block', role: 'img', 'aria-label': 'A pixel-art grass block slowly rotating' },
    h('div', { class: 'hb-glow' }),
    particles,
    stage,
    h('div', { class: 'hb-shadow' }),
  );

  const reduce = prefersReducedMotion();
  let yaw = -38;
  let pitch = -24;
  let velocity = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let lastT = 0;
  let raf = 0;
  let visible = true;
  let t0 = performance.now();

  const render = (now: number) => {
    const t = (now - t0) / 1000;
    const bob = reduce ? 0 : Math.sin(t * 1.6) * 8;
    cube.style.transform = `translateY(${bob.toFixed(2)}px) rotateX(${pitch.toFixed(2)}deg) rotateY(${yaw.toFixed(2)}deg)`;
    el.style.setProperty('--bob', (bob / 8).toFixed(3));
    // per-face lighting: rotate each normal like CSS does (rotateY first, then rotateX)
    const ry = (yaw * Math.PI) / 180;
    const rx = (pitch * Math.PI) / 180;
    for (const [name, n] of Object.entries(NORMALS) as [FaceName, [number, number, number]][]) {
      const x = n[0];
      const y = -n[1];
      const z = n[2];
      const x1 = Math.cos(ry) * x + Math.sin(ry) * z;
      const z1 = -Math.sin(ry) * x + Math.cos(ry) * z;
      const y2 = Math.cos(rx) * y - Math.sin(rx) * z1;
      const z2 = Math.sin(rx) * y + Math.cos(rx) * z1;
      const d = x1 * LIGHT[0] + y2 * LIGHT[1] + z2 * LIGHT[2];
      const bright = 0.52 + 0.48 * Math.max(0, d);
      shades.get(name)!.style.opacity = (1 - bright).toFixed(3);
    }
  };

  const tick = (now: number) => {
    raf = 0;
    if (!visible) return;
    const dt = Math.min(0.05, (now - lastT) / 1000 || 0);
    lastT = now;
    if (!dragging) {
      if (Math.abs(velocity) > 2) {
        yaw += velocity * dt;
        velocity *= Math.pow(0.12, dt);
      } else {
        velocity = 0;
        if (!reduce) yaw += 16 * dt;
      }
      pitch += (-24 - pitch) * Math.min(1, dt * 2);
    }
    render(now);
    if (!reduce || dragging || velocity !== 0) raf = requestAnimationFrame(tick);
  };
  const kick = () => {
    if (!raf && visible) {
      lastT = performance.now();
      raf = requestAnimationFrame(tick);
    }
  };

  stage.addEventListener('pointerdown', (e) => {
    dragging = true;
    velocity = 0;
    lastX = e.clientX;
    lastY = e.clientY;
    stage.setPointerCapture(e.pointerId);
    el.classList.add('dragging');
    kick();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    yaw += dx * 0.6;
    pitch = Math.max(-60, Math.min(20, pitch - dy * 0.4));
    velocity = velocity * 0.6 + dx * 0.6 * 60 * 0.4;
    render(performance.now());
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('dragging');
    kick();
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  const io =
    typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((entries) => {
          visible = entries.some((en) => en.isIntersecting) && !document.hidden;
          if (visible) kick();
        })
      : null;
  io?.observe(el);
  const onVis = () => {
    visible = !document.hidden;
    if (visible) kick();
  };
  document.addEventListener('visibilitychange', onVis);

  render(performance.now());
  kick();

  return {
    el,
    destroy() {
      cancelAnimationFrame(raf);
      raf = 0;
      visible = false;
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      t0 = 0;
    },
  };
}
