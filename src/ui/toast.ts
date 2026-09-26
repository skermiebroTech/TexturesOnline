// Toast notifications (bottom-right stack, bottom sheet width on phones).

import { h } from './dom';
import { icon, type IconName } from './icons';
import { showInTopLayer } from './popover';

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
  region = h('div', { class: 'toast-region', role: 'region', 'aria-label': 'Notifications' });
  document.body.appendChild(region);
  return region;
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

  const close = () => {
    if (closed) return;
    closed = true;
    if (timer) clearTimeout(timer);
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
    {
      class: ['toast', `tone-${tone}`],
      role: tone === 'error' ? 'alert' : 'status',
      'aria-live': tone === 'error' ? 'assertive' : 'polite',
    },
    icon(TONE_ICON[tone]),
    h('div', { class: 'toast-msg' }, msg),
    actions,
  );

  const start = () => {
    if (duration <= 0 || closed) return;
    startedAt = Date.now();
    timer = setTimeout(close, remaining);
  };
  const pause = () => {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
    remaining = Math.max(1200, remaining - (Date.now() - startedAt));
  };
  el.addEventListener('pointerenter', pause);
  el.addEventListener('pointerleave', start);
  el.addEventListener('focusin', pause);
  el.addEventListener('focusout', start);

  reg.appendChild(el);
  const live = Array.from(reg.children).filter((c) => !c.classList.contains('leaving'));
  if (live.length > MAX_VISIBLE) live.slice(0, live.length - MAX_VISIBLE).forEach((c) => c.remove());
  if (document.querySelector('dialog[open]')) showInTopLayer(reg);
  start();
  return { close };
}
