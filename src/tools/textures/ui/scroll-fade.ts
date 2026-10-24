// Horizontal scrollers (the tool rail on phones, the options bar, the palette, the "Used by" chips):
// the side with more to show fades out (see .is-scroller in view.css), so a control cut by the edge
// reads as "scroll for more" instead of looking broken.
//
// All scrollers are measured together once per frame (every read, then every class change, and only
// the classes that change), so a tap or a scroll doesn't lay the page out once per scroller.

interface Fade {
  sc: HTMLElement;
  state: string;
}

const dirty = new Set<Fade>();
let frame = 0;

function measure(f: Fade): string {
  const sc = f.sc;
  const max = sc.scrollWidth - sc.clientWidth;
  const on = max > 2 && getComputedStyle(sc).flexDirection !== 'column';
  return `${on ? 1 : 0}${on && sc.scrollLeft > 2 ? 1 : 0}${on && sc.scrollLeft < max - 2 ? 1 : 0}`;
}

function apply(f: Fade, state: string) {
  if (state === f.state) return;
  f.state = state;
  f.sc.classList.toggle('is-scroller', state[0] === '1');
  f.sc.classList.toggle('can-left', state[1] === '1');
  f.sc.classList.toggle('can-right', state[2] === '1');
}

function flush() {
  frame = 0;
  const list = [...dirty].filter((f) => f.sc.isConnected);
  dirty.clear();
  const states = list.map(measure);
  list.forEach((f, i) => apply(f, states[i]));
}

function schedule(f: Fade) {
  dirty.add(f);
  if (!frame) frame = requestAnimationFrame(flush);
}

export function scrollFade(sc: HTMLElement): { paint(): void; destroy(): void } {
  const f: Fade = { sc, state: '' };
  const later = () => schedule(f);
  sc.addEventListener('scroll', later, { passive: true });
  // its own size, and what it holds (chips re-rendered, a tool's options shown or hidden)
  const ro = new ResizeObserver(later);
  ro.observe(sc);
  const mo = new MutationObserver(later);
  mo.observe(sc, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  return {
    /** Measures again before the next paint, with the other scrollers. */
    paint: later,
    destroy() {
      ro.disconnect();
      mo.disconnect();
      dirty.delete(f);
      sc.removeEventListener('scroll', later);
    },
  };
}
