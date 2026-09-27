// Renders pack text (names, tooltips from .lang files) as DOM: § colour and style codes become
// styled spans. Text is only ever inserted as text nodes, never as HTML.

import { h } from '../../../ui/dom';
import { formatRuns } from './properties';

export function formatted(text: string, cls?: string): HTMLElement {
  const el = h('span', { class: ['pe-fmt', cls] });
  for (const run of formatRuns(text)) {
    if (!run.color && !run.bold && !run.italic && !run.underline && !run.strike) {
      el.append(run.text);
      continue;
    }
    el.append(
      h(
        'span',
        {
          class: [run.color && `mc-c${run.color}`, run.bold && 'mc-bold', run.italic && 'mc-italic', run.underline && 'mc-under', run.strike && 'mc-strike'],
        },
        run.text,
      ),
    );
  }
  return el;
}
