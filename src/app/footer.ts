// Site footer shared by the home, help, guide and tool start pages (markup in content/chrome.ts,
// identical to the prerendered footer), in the current page's language. The running app adds an
// "Install app" link to the last column (shown only where installing is possible).

import { currentLocale, currentRoute } from '../core/router';
import { footer } from './content/chrome';
import { toDom } from './markup-dom';
import { footerInstallLink } from '../pwa/install';
import type { Locale } from '../i18n/locales';

export function siteFooter(): HTMLElement {
  const route = currentRoute();
  const locale = route?.locale ?? currentLocale();
  const el = toDom(footer(new Date().getFullYear(), locale, route?.path ?? '/'));
  el.querySelector('.footer-col:last-child')?.append(footerInstallLink(locale));
  return el;
}

/** Adds the "Install app" link to a prerendered footer the view took over. */
export function wireFooter(root: ParentNode, locale: Locale): void {
  const col = root.querySelector('.site-footer .footer-col:last-child');
  if (col && !col.querySelector('.footer-install')) col.append(footerInstallLink(locale));
}
