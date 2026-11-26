// Adds the tool introduction (what it does, how to use it, questions, guides) below the start
// screens of the texture, skin and shader tools, matching the prerendered /textures/, /skins/ and
// /shaders/ pages (in the page's language; the tool itself is English).

import '../tools/help/help.css';
import './content/content.css';
import { siteFooter } from './footer';
import { toDom } from './markup-dom';
import { loadToolIntro, toolIntro, type IntroTool } from './content/tools';
import { loadContent } from '../i18n/content';
import type { Locale } from '../i18n/locales';

/** Starts fetching a tool's introduction (each tool's is a chunk of its own), so it is there when the tool renders. */
export function preloadToolIntro(tool: IntroTool): void {
  loadToolIntro(tool).catch(() => undefined);
}

export async function mountToolIntro(root: HTMLElement, tool: IntroTool, locale: Locale = 'en'): Promise<void> {
  const [intro] = await Promise.allSettled([loadToolIntro(tool), loadContent(locale, 'tools').catch((err) => console.warn('Translation unavailable', err))]);
  if (intro.status === 'rejected') throw intro.reason;
  if (!root.isConnected || root.querySelector('[data-tool-intro]')) return;
  const section = toDom(toolIntro(tool, { prerender: false, locale }));
  const footer = root.querySelector('.site-footer');
  if (footer) footer.before(section);
  else root.append(section, siteFooter());
}
