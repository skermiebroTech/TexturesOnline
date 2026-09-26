// Install instructions for each target (used by the Pack panel and the export success screen).

import { h } from '../../../ui/dom';
import { icon } from '../../../ui/icons';
import type { ShaderTargetInfo } from '../targets';

export function installSteps(target: ShaderTargetInfo, opts: { compact?: boolean } = {}): HTMLElement {
  return h(
    'ol',
    { class: ['sh-steps', opts.compact && 'is-compact'] },
    target.install.map((s) =>
      h(
        'li',
        null,
        h('span', null, s.text),
        s.path
          ? h(
              'span',
              { class: 'sh-menu-path' },
              s.path.map((p, i) => [i > 0 ? icon('chevron-right', { class: 'sh-menu-sep' }) : null, h('span', { class: 'sh-menu-item' }, p)]),
            )
          : null,
      ),
    ),
  );
}

export function helpLink(target: ShaderTargetInfo, label = 'Full install guide'): HTMLAnchorElement {
  return h('a', { class: 'sh-help-link', href: `#/help?s=${target.helpSection}` }, icon('book-open'), h('span', null, label), icon('arrow-right'));
}
