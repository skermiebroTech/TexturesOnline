// Adds the tool introduction (what it does, how to use it, questions, guides) below the start
// screens of the texture, skin and shader tools, matching the prerendered /textures/, /skins/ and
// /shaders/ pages (in the page's language; the tool itself is English).

import '../tools/help/help.css';
import './content/content.css';
import { siteFooter } from './footer';
import { toDom } from './markup-dom';
import { toolIntro, type IntroTool } from './content/tools';
import { loadContent } from '../i18n/content';
import type { Locale } from '../i18n/locales';

export async function mountToolIntro(root: HTMLElement, tool: IntroTool, locale: Locale = 'en'): Promise<void> {
  await loadContent(locale).catch((err) => console.warn('Translation unavailable', err));
  if (!root.isConnected || root.querySelector('[data-tool-intro]')) return;
  const section = toDom(toolIntro(tool, { prerender: false, locale }));
  const footer = root.querySelector('.site-footer');
  if (footer) footer.before(section);
  else root.append(section, siteFooter());
}
