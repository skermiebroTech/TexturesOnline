// Placeholder view shown until the full shader maker is available.
import type { RouteContext } from '../../core/router';
import { h } from '../../ui/dom';
import { button, emptyState } from '../../ui/components';

export default function view(root: HTMLElement, _ctx: RouteContext): void {
  root.append(
    h(
      'div',
      { class: 'container accent-purple', style: { flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 24px' } },
      emptyState({
        icon: 'sparkles',
        title: 'Shader Maker — coming soon',
        text: 'Build Iris/OptiFine shader packs, no-mod vanilla shaders and Bedrock Vibrant Visuals packs with sliders and presets.',
        action: button({ label: 'Back home', icon: 'home', onClick: () => (location.hash = '#/') }),
      }),
    ),
  );
}
