// Anchored popovers and menus. Uses the Popover API (top layer) when available so popovers
// also work above modal dialogs; falls back to fixed positioning.

import { h } from './dom';
import { icon, type IconName } from './icons';

export type Placement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' | 'right-start';

export interface PopoverHandle {
  el: HTMLElement;
  close(): void;
  reposition(): void;
  readonly open: boolean;
}

export interface PopoverOptions {
  placement?: Placement;
  /** px gap between anchor and popover */
  offset?: number;
  /** Make the popover at least as wide as the anchor */
  matchWidth?: boolean;
  class?: string;
  /** Element (or true = first focusable) to focus when opened */
  focus?: HTMLElement | boolean;
  /** Return focus to the anchor on close (default true) */
  restoreFocus?: boolean;
  onClose?: () => void;
  role?: string;
  label?: string;
}

const stack: PopoverHandle[] = [];
/** The open popover of each anchor, so a second click on the anchor toggles it closed. */
const byAnchor = new WeakMap<HTMLElement, PopoverHandle>();
const supportsPopover = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype;

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function firstFocusable(root: ParentNode): HTMLElement | null {
  return root.querySelector<HTMLElement>(FOCUSABLE);
}

/** Position `el` (position: fixed) next to `anchor`, flipping and clamping to the viewport. */
export function positionFloating(el: HTMLElement, anchor: HTMLElement | DOMRect, placement: Placement = 'bottom-start', offset = 6, matchWidth = false): void {
  const r = anchor instanceof HTMLElement ? anchor.getBoundingClientRect() : anchor;
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const margin = 8;
  if (matchWidth) el.style.minWidth = `${Math.round(r.width)}px`;
  el.style.maxHeight = '';
  const w = el.offsetWidth;
  const hgt = el.offsetHeight;

  let top: number;
  let left: number;
  if (placement === 'right-start') {
    left = r.right + offset;
    top = r.top;
    if (left + w > vw - margin) left = r.left - offset - w;
  } else {
    const below = r.bottom + offset;
    const above = r.top - offset - hgt;
    const wantTop = placement.startsWith('top');
    const fitsBelow = below + hgt <= vh - margin;
    const fitsAbove = above >= margin;
    if (wantTop) top = fitsAbove || !fitsBelow ? above : below;
    else top = fitsBelow || !fitsAbove ? below : above;
    if (!fitsBelow && !fitsAbove) {
      // not enough room either way: use the larger side and scroll inside
      const spaceBelow = vh - margin - (r.bottom + offset);
      const spaceAbove = r.top - offset - margin;
      if (spaceBelow >= spaceAbove) {
        top = r.bottom + offset;
        el.style.maxHeight = `${spaceBelow}px`;
      } else {
        el.style.maxHeight = `${spaceAbove}px`;
        top = margin;
      }
    }
    left = placement.endsWith('end') ? r.right - w : r.left;
  }
  left = Math.max(margin, Math.min(left, vw - margin - w));
  top = Math.max(margin, Math.min(top, vh - margin - Math.min(hgt, vh - 2 * margin)));
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
}

/** Container for floating UI: the open modal dialog (so it stays interactive) or <body>. */
export function floatingHost(anchor?: Element | null): HTMLElement {
  const dlg = anchor?.closest('dialog[open]') as HTMLElement | null;
  if (dlg) return dlg;
  const open = document.querySelectorAll('dialog[open]');
  return (open[open.length - 1] as HTMLElement | undefined) ?? document.body;
}

export function showInTopLayer(el: HTMLElement): void {
  if (supportsPopover) {
    el.setAttribute('popover', 'manual');
    try {
      if (el.matches(':popover-open')) el.hidePopover();
      el.showPopover();
    } catch {
      /* not connected or unsupported */
    }
  }
}

export function openPopover(anchor: HTMLElement, content: Node, opts: PopoverOptions = {}): PopoverHandle {
  const existing = byAnchor.get(anchor);
  if (existing?.open) {
    existing.close();
    return existing;
  }
  const el = h('div', { class: ['popover', opts.class], role: opts.role ?? 'dialog', 'aria-label': opts.label });
  el.appendChild(content);
  floatingHost(anchor).appendChild(el);
  showInTopLayer(el);

  let isOpen = true;
  const reposition = () => {
    if (isOpen) positionFloating(el, anchor, opts.placement, opts.offset ?? 6, opts.matchWidth);
  };
  reposition();

  const onPointerDown = (e: PointerEvent) => {
    const t = e.target as Node;
    if (el.contains(t) || anchor.contains(t)) return;
    // a click inside a newer popover (nested) must not close this one
    const idx = stack.indexOf(handle);
    for (let i = idx + 1; i < stack.length; i++) if (stack[i].el.contains(t)) return;
    handle.close();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && stack[stack.length - 1] === handle) {
      e.preventDefault();
      e.stopPropagation();
      handle.close();
    }
  };
  const onScroll = (e: Event) => {
    if (e.target instanceof Node && el.contains(e.target)) return;
    if (!anchor.isConnected) {
      handle.close();
      return;
    }
    reposition();
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => reposition()) : null;
  ro?.observe(el);

  setTimeout(() => {
    if (!isOpen) return;
    document.addEventListener('pointerdown', onPointerDown, true);
  }, 0);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('scroll', onScroll, true);
  window.addEventListener('resize', reposition);

  const handle: PopoverHandle = {
    el,
    get open() {
      return isOpen;
    },
    reposition,
    close() {
      if (!isOpen) return;
      isOpen = false;
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', reposition);
      ro?.disconnect();
      const i = stack.indexOf(handle);
      if (i >= 0) stack.splice(i, 1);
      if (byAnchor.get(anchor) === handle) byAnchor.delete(anchor);
      anchor.setAttribute('aria-expanded', 'false');
      const hadFocus = el.contains(document.activeElement);
      el.remove();
      if ((opts.restoreFocus ?? true) && hadFocus && anchor.isConnected) anchor.focus({ preventScroll: true });
      opts.onClose?.();
    },
  };
  stack.push(handle);
  byAnchor.set(anchor, handle);
  anchor.setAttribute('aria-expanded', 'true');

  if (opts.focus) {
    requestAnimationFrame(() => {
      const target = opts.focus instanceof HTMLElement ? opts.focus : firstFocusable(el);
      target?.focus({ preventScroll: true });
    });
  }
  return handle;
}

export function closeAllPopovers(): void {
  for (const p of stack.slice().reverse()) p.close();
}

export interface MenuItem {
  label: string;
  icon?: IconName;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

/** Simple action menu anchored to a button (arrow-key navigable). */
export function openMenu(anchor: HTMLElement, items: MenuItem[], opts: { placement?: Placement; label?: string } = {}): PopoverHandle {
  const list = h('div', { class: 'menu', role: 'menu', 'aria-label': opts.label });
  const buttons: HTMLButtonElement[] = [];
  let handle: PopoverHandle | null = null;
  for (const item of items) {
    const b = h(
      'button',
      {
        type: 'button',
        class: ['menu-item', item.danger && 'danger'],
        role: 'menuitem',
        tabIndex: -1,
        disabled: item.disabled,
        on: {
          click: () => {
            handle?.close();
            item.onClick();
          },
        },
      },
      item.icon ? icon(item.icon) : null,
      h('span', null, item.label),
    );
    buttons.push(b);
    list.appendChild(b);
  }
  list.addEventListener('keydown', (e) => {
    const enabled = buttons.filter((b) => !b.disabled);
    const i = enabled.indexOf(document.activeElement as HTMLButtonElement);
    let next = -1;
    if (e.key === 'ArrowDown') next = (i + 1) % enabled.length;
    else if (e.key === 'ArrowUp') next = (i - 1 + enabled.length) % enabled.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = enabled.length - 1;
    else if (e.key === 'Tab') {
      handle?.close();
      return;
    }
    if (next >= 0) {
      e.preventDefault();
      enabled[next]?.focus();
    }
  });
  anchor.setAttribute('aria-expanded', 'true');
  handle = openPopover(anchor, list, {
    placement: opts.placement ?? 'bottom-end',
    role: 'presentation',
    focus: buttons.find((b) => !b.disabled) ?? true,
    onClose: () => anchor.setAttribute('aria-expanded', 'false'),
  });
  return handle;
}
