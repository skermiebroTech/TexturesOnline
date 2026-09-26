// Placeholder view shown until the full texture pack maker is available.
import type { RouteContext } from '../../core/router';
import { h } from '../../ui/dom';
import { button, emptyState } from '../../ui/components';

export default function view(root: HTMLElement, _ctx: RouteContext): void {
  root.append(
    h(
      'div',
      { class: 'container accent-green', style: { flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 24px' } },
      emptyState({
        icon: 'image',
        title: 'Texture Pack Maker — coming soon',
        text: 'Browse every vanilla texture, paint pixels, apply one-click effects and export packs for Java or Bedrock.',
        action: button({ label: 'Back home', icon: 'home', onClick: () => (location.hash = '#/') }),
      }),
    ),
  );
}
