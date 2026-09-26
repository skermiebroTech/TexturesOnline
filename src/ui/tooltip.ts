// Lightweight tooltips: one shared floating element, shown on hover (after a delay) and on
// keyboard focus. Calling tooltip() again on the same element just updates the text.

import { floatingHost, positionFloating, showInTopLayer } from './popover';

let tipEl: HTMLDivElement | null = null;
let showTimer: ReturnType<typeof setTimeout> | null = null;
let activeTarget: HTMLElement | null = null;
const attached = new WeakSet<HTMLElement>();

function ensureTip(): HTMLDivElement {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.className = 'tooltip';
    tipEl.setAttribute('role', 'tooltip');
    tipEl.id = 'to-tooltip';
  }
  return tipEl;
}

function show(target: HTMLElement): void {
  const text = target.dataset.tooltip;
  if (!text || !target.isConnected) return;
  const tip = ensureTip();
  tip.textContent = text;
  const host = floatingHost(target);
  if (tip.parentNode !== host) host.appendChild(tip);
  showInTopLayer(tip);
  tip.classList.remove('show');
  positionFloating(tip, target, 'top-start', 8);
  // centre over the target when there is room
  const r = target.getBoundingClientRect();
  const w = tip.offsetWidth;
  const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, document.documentElement.clientWidth - w - 8));
  tip.style.left = `${Math.round(left)}px`;
  activeTarget = target;
  requestAnimationFrame(() => tip.classList.add('show'));
}

export function hideTooltip(): void {
  if (showTimer) clearTimeout(showTimer);
  showTimer = null;
  activeTarget = null;
  if (tipEl) {
    tipEl.classList.remove('show');
    tipEl.remove();
  }
}

export function tooltip(el: HTMLElement, text: string): void {
  el.dataset.tooltip = text;
  const hasName = el.hasAttribute('aria-label') || (el.textContent ?? '').trim().length > 0;
  if (!hasName) el.setAttribute('aria-label', text);
  if (activeTarget === el && tipEl) tipEl.textContent = text;
  if (attached.has(el)) return;
  attached.add(el);

  el.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'touch') return;
    if (showTimer) clearTimeout(showTimer);
    showTimer = setTimeout(() => show(el), activeTarget ? 60 : 450);
  });
  el.addEventListener('pointerleave', hideTooltip);
  el.addEventListener('pointerdown', hideTooltip);
  el.addEventListener('focus', () => {
    if (el.matches(':focus-visible')) show(el);
  });
  el.addEventListener('blur', hideTooltip);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && activeTarget === el) hideTooltip();
  });
}
