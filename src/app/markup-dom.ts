// Runtime counterpart of markup.ts: builds real DOM from the same trees the build prerenders, so a
// booted page is identical to the static HTML it replaces.

import { href } from '../core/router';
import { icon } from '../ui/icons';
import { logoMark } from '../ui/logo';
import { flatten, resolvedAttrs, type Child, type MNode } from './markup';

function nodeToDom(n: MNode | string): Node {
  if (typeof n === 'string') return document.createTextNode(n);
  if (n.kind === 'icon') return icon(n.name, { class: n.class, size: n.size, label: n.label });
  if (n.kind === 'logo') return logoMark(n.size, n.label);
  const el = document.createElement(n.tag);
  for (const [k, v] of resolvedAttrs(n.attrs, href)) el.setAttribute(k, v);
  for (const c of flatten(n.children)) el.appendChild(nodeToDom(c));
  return el;
}

/** DOM for a single element tree. */
export function toDom<T extends Element = HTMLElement>(node: MNode): T {
  return nodeToDom(node) as unknown as T;
}

/** DOM nodes for any children list. */
export function toDomAll(children: Child[]): Node[] {
  return flatten(children).map(nodeToDom);
}
