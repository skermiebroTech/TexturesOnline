// Horizontal scrollers (the tool rail on phones, the options bar, the palette, the "Used by" chips):
// the side with more to show fades out (see .is-scroller in view.css), so a control cut by the edge
// reads as "scroll for more" instead of looking broken.

export function scrollFade(sc: HTMLElement): { paint(): void; destroy(): void } {
  let frame = 0;
  const paint = () => {
    const max = sc.scrollWidth - sc.clientWidth;
    const on = max > 2 && getComputedStyle(sc).flexDirection !== 'column';
    sc.classList.toggle('is-scroller', on);
    sc.classList.toggle('can-left', on && sc.scrollLeft > 2);
    sc.classList.toggle('can-right', on && sc.scrollLeft < max - 2);
  };
  const later = () => {
    if (!frame) frame = requestAnimationFrame(() => ((frame = 0), paint()));
  };
  sc.addEventListener('scroll', paint, { passive: true });
  // its own size, and what it holds (chips re-rendered, a tool's options shown or hidden)
  const ro = new ResizeObserver(later);
  ro.observe(sc);
  const mo = new MutationObserver(later);
  mo.observe(sc, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  return {
    paint,
    destroy() {
      ro.disconnect();
      mo.disconnect();
      cancelAnimationFrame(frame);
      sc.removeEventListener('scroll', paint);
    },
  };
}
