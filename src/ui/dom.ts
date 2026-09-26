// Tiny DOM helpers: hyperscript-style element creation and queries.

export type Child = Node | string | number | null | undefined | false | Child[];

type Listener = (ev: never) => void;

export interface Props {
  class?: string | (string | false | null | undefined)[];
  className?: string;
  style?: string | Partial<Record<string, string | number | null | undefined>>;
  dataset?: Record<string, string | number | boolean | undefined>;
  on?: Partial<Record<string, Listener>>;
  attrs?: Record<string, string | number | boolean | null | undefined>;
  [prop: string]: unknown;
}

function applyStyle(el: HTMLElement | SVGElement, style: Props['style']): void {
  if (style == null) return;
  if (typeof style === 'string') {
    el.setAttribute('style', style);
    return;
  }
  for (const [k, v] of Object.entries(style)) {
    if (v == null) continue;
    if (k.startsWith('--') || k.includes('-')) el.style.setProperty(k, String(v));
    else (el.style as unknown as Record<string, string>)[k] = typeof v === 'number' && !unitless.has(k) ? `${v}px` : String(v);
  }
}

const unitless = new Set(['opacity', 'zIndex', 'flex', 'flexGrow', 'flexShrink', 'order', 'fontWeight', 'lineHeight', 'zoom']);

function applyProps(el: HTMLElement | SVGElement, props: Props | null | undefined): void {
  if (!props) return;
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;
    switch (key) {
      case 'class':
      case 'className': {
        const cls = Array.isArray(value) ? value.filter(Boolean).join(' ') : String(value ?? '');
        if (cls) el.setAttribute('class', [el.getAttribute('class'), cls].filter(Boolean).join(' '));
        break;
      }
      case 'style':
        applyStyle(el, value as Props['style']);
        break;
      case 'dataset':
        for (const [dk, dv] of Object.entries(value as Record<string, unknown>)) {
          if (dv !== undefined && dv !== false) el.dataset[dk] = dv === true ? '' : String(dv);
        }
        break;
      case 'on':
        for (const [ev, fn] of Object.entries(value as Record<string, EventListener>)) {
          if (fn) el.addEventListener(ev, fn);
        }
        break;
      case 'attrs':
        for (const [ak, av] of Object.entries(value as Record<string, unknown>)) {
          if (av === false || av == null) continue;
          el.setAttribute(ak, av === true ? '' : String(av));
        }
        break;
      default:
        if (key.startsWith('aria-') || key.startsWith('data-') || key === 'role' || el instanceof SVGElement) {
          if (value === false || value === null) continue;
          el.setAttribute(key, value === true ? '' : String(value));
        } else if (key === 'for') {
          el.setAttribute('for', String(value));
        } else {
          (el as unknown as Record<string, unknown>)[key] = value;
        }
    }
  }
}

export function append(parent: Node, ...children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(parent, ...c);
    else if (c instanceof Node) parent.appendChild(c);
    else parent.appendChild(document.createTextNode(String(c)));
  }
}

/** Create an HTML element: h('button', { class: 'btn', on: { click } }, 'Label') */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  applyProps(el, props);
  append(el, ...children);
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Create an SVG element (attributes are set verbatim). */
export function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs?: Record<string, string | number | null | undefined> | null, ...children: Child[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, String(v));
  }
  append(el, ...children);
  return el;
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function qs<T extends Element>(sel: string, root: ParentNode = document): T | null {
  return root.querySelector<T>(sel as never) as T | null;
}

export function qsa<T extends Element>(sel: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll(sel)) as T[];
}

/** addEventListener that returns its own remover. */
export function listen<K extends keyof WindowEventMap>(target: Window, type: K, fn: (ev: WindowEventMap[K]) => void, opts?: AddEventListenerOptions | boolean): () => void;
export function listen<K extends keyof DocumentEventMap>(target: Document, type: K, fn: (ev: DocumentEventMap[K]) => void, opts?: AddEventListenerOptions | boolean): () => void;
export function listen<K extends keyof HTMLElementEventMap>(target: HTMLElement, type: K, fn: (ev: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions | boolean): () => void;
export function listen(target: EventTarget, type: string, fn: (ev: Event) => void, opts?: AddEventListenerOptions | boolean): () => void;
export function listen(target: EventTarget, type: string, fn: (ev: Event) => void, opts?: AddEventListenerOptions | boolean): () => void {
  target.addEventListener(type, fn, opts);
  return () => target.removeEventListener(type, fn, opts);
}

let uidCounter = 0;
/** Unique DOM id for label/aria wiring. */
export function uid(prefix = 'to'): string {
  uidCounter += 1;
  return `${prefix}-${uidCounter.toString(36)}`;
}

/** True when the user asked the OS for reduced motion. */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** True when focus is in a text field (keyboard shortcuts should be ignored). */
export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'range', 'color', 'file', 'submit', 'reset'].includes(el.type);
  }
  return false;
}

export { formatBytes, timeAgo } from './format';
