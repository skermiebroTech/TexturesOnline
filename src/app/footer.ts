// Site footer shared by the home, help, guide and tool start pages (markup in content/chrome.ts,
// identical to the prerendered footer).

import { footer } from './content/chrome';
import { toDom } from './markup-dom';

export function siteFooter(): HTMLElement {
  return toDom(footer(new Date().getFullYear()));
}
