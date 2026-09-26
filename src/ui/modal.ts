// Modal dialogs built on <dialog>: focus trapping, Esc/backdrop close, busy async actions.

import { h, uid } from './dom';
import { icon } from './icons';
import { toast } from './toast';
import { closeAllPopovers, firstFocusable } from './popover';
import { hideTooltip } from './tooltip';
import { setButtonBusy } from './components';

export interface ModalAction {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  /** Return false (or a promise resolving to false) to keep the modal open */
  onClick?: () => void | boolean | Promise<void | boolean>;
}

export interface ModalOptions {
  title: string;
  body: Node;
  actions?: ModalAction[];
  width?: number;
  onClose?: () => void;
  /** Allow closing with Esc, the close button and backdrop clicks (default true) */
  dismissible?: boolean;
  class?: string;
  /** Element to focus first (default: first field in the body, else the main action) */
  initialFocus?: HTMLElement;
}

let openCount = 0;

export function openModal(opts: ModalOptions): { close(): void; el: HTMLElement; setBusy(busy: boolean): void } {
  const dismissible = opts.dismissible ?? true;
  const titleId = uid('modal-title');
  const previouslyFocused = document.activeElement as HTMLElement | null;
  closeAllPopovers();
  hideTooltip();

  const closeBtn = dismissible
    ? h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close dialog', on: { click: () => close() } }, icon('close'))
    : null;
  const footer = opts.actions?.length ? h('div', { class: 'modal-footer' }) : null;
  const dlg = h(
    'dialog',
    { class: ['modal', opts.class], 'aria-labelledby': titleId },
    h('div', { class: 'modal-header' }, h('h2', { class: 'modal-title', id: titleId }, opts.title), closeBtn),
    h('div', { class: 'modal-body' }, opts.body),
    footer,
  );
  if (opts.width) dlg.style.setProperty('--modal-w', `${opts.width}px`);

  let closed = false;
  let busy = false;
  const buttons: HTMLButtonElement[] = [];

  function close(): void {
    if (closed) return;
    closed = true;
    closeAllPopovers();
    hideTooltip();
    dlg.classList.add('closing');
    const finish = () => {
      if (!dlg.isConnected) return;
      try {
        dlg.close();
      } catch {
        /* already closed */
      }
      dlg.remove();
      openCount = Math.max(0, openCount - 1);
      if (openCount === 0) document.documentElement.classList.remove('modal-open');
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true });
      opts.onClose?.();
    };
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) finish();
    else {
      dlg.addEventListener('animationend', (e) => {
        if (e.target === dlg) finish();
      });
      setTimeout(finish, 220);
    }
  }

  const setBusy = (v: boolean) => {
    busy = v;
    buttons.forEach((b) => (b.disabled = v));
    if (closeBtn) closeBtn.disabled = v;
  };

  for (const action of opts.actions ?? []) {
    const b = h('button', { type: 'button', class: ['btn', `btn-${action.variant ?? 'secondary'}`] }, h('span', { class: 'btn-label' }, action.label));
    b.addEventListener('click', async () => {
      if (busy) return;
      let result: void | boolean;
      try {
        const r = action.onClick?.();
        if (r instanceof Promise) {
          setBusy(true);
          setButtonBusy(b, true);
          try {
            result = await r;
          } finally {
            setButtonBusy(b, false);
            setBusy(false);
          }
        } else {
          result = r;
        }
      } catch (err) {
        console.error(err);
        toast(err instanceof Error && err.message ? err.message : 'Something went wrong. Please try again.', { tone: 'error' });
        return;
      }
      if (result !== false) close();
    });
    buttons.push(b);
    footer?.appendChild(b);
  }

  dlg.addEventListener('cancel', (e) => {
    e.preventDefault();
    if (dismissible && !busy) close();
  });
  let downOnBackdrop = false;
  dlg.addEventListener('pointerdown', (e) => {
    downOnBackdrop = e.target === dlg;
  });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg && downOnBackdrop && dismissible && !busy) close();
    downOnBackdrop = false;
  });

  document.body.appendChild(dlg);
  openCount += 1;
  document.documentElement.classList.add('modal-open');
  dlg.showModal();

  const body = dlg.querySelector('.modal-body') as HTMLElement;
  const field = body.querySelector<HTMLElement>('input:not([type=hidden]):not([disabled]), textarea, select');
  const main = buttons.length ? (opts.actions?.[opts.actions.length - 1]?.variant === 'danger' ? buttons[0] : buttons[buttons.length - 1]) : null;
  const target = opts.initialFocus ?? field ?? main ?? firstFocusable(dlg);
  target?.focus({ preventScroll: true });
  if (target instanceof HTMLInputElement && target.type === 'text') target.select();

  return { close, el: dlg, setBusy };
}

export function confirmDialog(title: string, text: string, confirmLabel = 'Confirm', danger = false): Promise<boolean> {
  return new Promise((resolve) => {
    let result = false;
    openModal({
      title,
      body: h('p', null, text),
      width: 440,
      actions: [
        { label: 'Cancel', variant: 'secondary' },
        {
          label: confirmLabel,
          variant: danger ? 'danger' : 'primary',
          onClick: () => {
            result = true;
          },
        },
      ],
      onClose: () => resolve(result),
    });
  });
}

export function promptDialog(title: string, label: string, initial = '', opts: { placeholder?: string; confirmLabel?: string; maxLength?: number } = {}): Promise<string | null> {
  return new Promise((resolve) => {
    let result: string | null = null;
    const id = uid('prompt');
    const input = h('input', { class: 'input', id, type: 'text', value: initial, placeholder: opts.placeholder ?? '', autocomplete: 'off', spellcheck: false });
    if (opts.maxLength) input.maxLength = opts.maxLength;
    const submit = () => {
      const v = input.value.trim();
      if (!v) {
        input.focus();
        return false;
      }
      result = v;
      return true;
    };
    const modal = openModal({
      title,
      width: 440,
      body: h('div', { class: 'field' }, h('label', { class: 'field-label', htmlFor: id }, label), input),
      actions: [
        { label: 'Cancel', variant: 'secondary' },
        { label: opts.confirmLabel ?? 'OK', variant: 'primary', onClick: submit },
      ],
      onClose: () => resolve(result),
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (submit()) modal.close();
      }
    });
  });
}

export interface ShortcutGroup {
  title: string;
  items: { keys: string[]; label: string }[];
}

/** Keyboard shortcuts sheet (editors open it with "?"). */
export function openShortcutsSheet(groups: ShortcutGroup[], title = 'Keyboard shortcuts'): { close(): void } {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const keyLabel = (k: string) => (k === 'Mod' ? (isMac ? '⌘' : 'Ctrl') : k === 'Alt' && isMac ? '⌥' : k === 'Shift' && isMac ? '⇧' : k);
  const body = h(
    'div',
    { class: 'shortcuts' },
    groups.map((g) =>
      h(
        'section',
        { class: 'shortcuts-group' },
        h('h3', { class: 'section-title' }, g.title),
        h(
          'dl',
          { class: 'shortcuts-list' },
          g.items.map((it) =>
            h(
              'div',
              { class: 'shortcuts-row' },
              h('dt', null, it.label),
              h('dd', null, it.keys.map((k, i) => [i > 0 ? h('span', { class: 'faint' }, '+') : null, h('kbd', { class: 'kbd' }, keyLabel(k))])),
            ),
          ),
        ),
      ),
    ),
  );
  const m = openModal({ title, body, width: 640, class: 'shortcuts-modal' });
  return { close: m.close };
}
