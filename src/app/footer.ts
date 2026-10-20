// Site footer shared by the home, help, guide and tool start pages (markup in content/chrome.ts,
// identical to the prerendered footer), in the current page's language.

import { currentLocale, currentRoute } from '../core/router';
import { footer } from './content/chrome';
import { toDom } from './markup-dom';

export function siteFooter(): HTMLElement {
  const route = currentRoute();
  return toDom(footer(new Date().getFullYear(), route?.locale ?? currentLocale(), route?.path ?? '/'));
}
