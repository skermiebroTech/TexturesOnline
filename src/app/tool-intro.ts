// Adds the tool introduction (what it does, how to use it, questions, guides) below the start
// screens of the texture, skin and shader tools, matching the prerendered /textures/, /skins/ and
// /shaders/ pages.

import '../tools/help/help.css';
import './content/content.css';
import { siteFooter } from './footer';
import { toDom } from './markup-dom';
import { toolIntro, type IntroTool } from './content/tools';

export function mountToolIntro(root: HTMLElement, tool: IntroTool): void {
  if (!root.isConnected || root.querySelector('[data-tool-intro]')) return;
  const section = toDom(toolIntro(tool, { prerender: false }));
  const footer = root.querySelector('.site-footer');
  if (footer) footer.before(section);
  else root.append(section, siteFooter());
}
