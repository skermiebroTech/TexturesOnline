// Toast notifications (bottom-right stack, bottom sheet width on phones).

import { h } from './dom';
import { icon, type IconName } from './icons';
import { floatingHost, showInTopLayer } from './popover';

type Tone = 'info' | 'success' | 'error' | 'warn';

const TONE_ICON: Record<Tone, IconName> = {
  info: 'circle-info',
  success: 'check',
  error: 'square-alert',
  warn: 'warning-diamond',
};
const MAX_VISIBLE = 4;

let region: HTMLElement | null = null;

function ensureRegion(): HTMLElement {
  if (region && region.isConnected) return region;
  // A polite live region that exists before any toast is added, so screen readers announce them.
  region = h('div', { class: 'toast-region', role: 'region', 'aria-label': 'Notifications', 'aria-live': 'polite', 'aria-relevant': 'additions' });
  document.body.appendChild(region);
  return region;
}

function isPopoverOpen(el: HTMLElement): boolean {
  try {
    return el.matches(':popover-open');
  } catch {
    return true; // no Popover API: nothing to show
  }
}

/** Create the notification live region early (call once at startup). */
export function initToasts(): void {
  ensureRegion();
}

/**
 * Keep the toast stack usable above modal dialogs: while a <dialog> is open everything outside it
 * is inert, so the stack moves inside the top-most open dialog (shown in the top layer) and back
 * to <body> when the dialogs close. Called by the modal helpers after opening/closing a dialog.
 */
export function syncToastLayer(): void {
  if (!region) return;
  const host = floatingHost();
  const moved = !region.isConnected || region.parentElement !== host;
  if (moved) host.appendChild(region);
  // (re)showing restarts the toasts' entry animation, so only when needed
  const topLayer = host !== document.body || region.hasAttribute('popover');
  if (topLayer && (moved || !isPopoverOpen(region))) showInTopLayer(region);
}

export interface ToastHandle {
  close(): void;
}

export function toast(
  msg: string,
  opts: { tone?: Tone; duration?: number; action?: { label: string; onClick: () => void } } = {},
): ToastHandle {
  const tone = opts.tone ?? 'info';
  const duration = opts.duration ?? (tone === 'error' ? 8000 : opts.action ? 6500 : 4200);
  const reg = ensureRegion();

  let closed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let remaining = duration;
  let startedAt = 0;
  let hovered = false;
  let focused = false;

  const close = () => {
    if (closed) return;
    closed = true;
    if (timer) clearTimeout(timer);
    timer = null;
    el.classList.add('leaving');
    const done = () => el.remove();
    el.addEventListener('animationend', done, { once: true });
    setTimeout(done, 260);
  };

  const actions = h('div', { class: 'toast-actions' });
  if (opts.action) {
    const { label, onClick } = opts.action;
    actions.appendChild(
      h(
        'button',
        {
          type: 'button',
          class: 'btn btn-ghost btn-sm',
          on: {
            click: () => {
              close();
              onClick();
            },
          },
        },
        label,
      ),
    );
  }
  actions.appendChild(h('button', { type: 'button', class: 'icon-btn sm', 'aria-label': 'Dismiss notification', on: { click: close } }, icon('close')));

  const el = h(
    'div',
    { class: ['toast', `tone-${tone}`], role: tone === 'error' ? 'alert' : undefined },
    icon(TONE_ICON[tone]),
    h('div', { class: 'toast-msg' }, msg),
    actions,
  );

  // The timer runs only while the toast is neither hovered nor focused.
  const start = () => {
    if (duration <= 0 || closed || timer || hovered || focused) return;
    startedAt = Date.now();
    timer = setTimeout(close, remaining);
  };
  const pause = () => {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
    remaining = Math.max(1200, remaining - (Date.now() - startedAt));
  };
  el.addEventListener('pointerenter', () => {
    hovered = true;
    pause();
  });
  el.addEventListener('pointerleave', () => {
    hovered = false;
    start();
  });
  el.addEventListener('focusin', () => {
    focused = true;
    pause();
  });
  el.addEventListener('focusout', (e) => {
    if (e.relatedTarget instanceof Node && el.contains(e.relatedTarget)) return;
    focused = false;
    start();
  });

  reg.appendChild(el);
  const live = Array.from(reg.children).filter((c) => !c.classList.contains('leaving'));
  if (live.length > MAX_VISIBLE) live.slice(0, live.length - MAX_VISIBLE).forEach((c) => c.remove());
  syncToastLayer();
  start();
  return { close };
}
