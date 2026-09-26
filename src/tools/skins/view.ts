// Placeholder view shown until the full skin editor is available.
import type { RouteContext } from '../../core/router';
import { h } from '../../ui/dom';
import { button, emptyState } from '../../ui/components';

export default function view(root: HTMLElement, _ctx: RouteContext): void {
  root.append(
    h(
      'div',
      { class: 'container accent-blue', style: { flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 24px' } },
      emptyState({
        icon: 'human',
        title: 'Skin Editor — coming soon',
        text: 'Paint on the 64×64 template with a live 3D preview, then export for Java or as a Bedrock skin pack.',
        action: button({ label: 'Back home', icon: 'home', onClick: () => (location.hash = '#/') }),
      }),
    ),
  );
}
